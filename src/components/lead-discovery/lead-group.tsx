import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Mail, Search, Trash2, UserSearch } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { SignalType, LeadStatus } from "@/lib/store";
import api from "@/lib/api";

export type LeadRow = {
  id: string;
  company: string;
  notes?: string;
  signalType?: SignalType;
  name: string;
  email?: string;
  linkedin_url?: string;
  status: LeadStatus;
  created_at: string;
  role?: string;
  enrichment_data?: { email_source?: string };
  source?: string;
};

const signalTones: Record<string, "turquoise" | "pink" | "blue" | "muted"> = {
  Funding: "turquoise",
  "Key hire": "blue",
  "Product launch": "pink",
  Other: "muted",
};
const statusTones: Record<LeadStatus, "turquoise" | "pink" | "blue" | "muted"> = {
  "Pending review": "muted",
  Approved: "turquoise",
  Skipped: "muted",
  Pushed: "blue",
};

const sectionTone = "bg-brand-turquoise/15 text-brand-turquoise border-brand-turquoise/30";

// Per-lead actions (status, delete, email, founder lookup, batch lookup) shared by every
// lead group on a page. Call once per page and pass the result to each <LeadGroup>.
export function useLeadActions() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [localEmails, setLocalEmails] = useState<Record<string, string>>({});
  const [batchLookupIds, setBatchLookupIds] = useState<Set<string>>(new Set());

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/leads/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
    onError: () => toast.error("Failed to update lead status"),
  });

  const deleteLeadMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/leads/${id}`),
    onSuccess: () => {
      toast.success("Lead deleted");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: () => toast.error("Failed to delete lead"),
  });

  const updateEmailMutation = useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) =>
      api.patch(`/api/leads/${id}`, { email }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
    onError: () => toast.error("Failed to save email"),
  });

  const findEmailMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/api/leads/${id}/find-email`).then((r) => r.data as { email: string | null }),
    onSuccess: (data, id) => {
      if (data.email) {
        setLocalEmails((prev) => ({ ...prev, [id]: data.email! }));
        toast.success(`Email found: ${data.email}`);
        queryClient.invalidateQueries({ queryKey: ["leads"] });
      } else {
        toast.info("No email found for this lead on Apollo");
      }
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Apollo lookup failed";
      toast.error(msg);
    },
  });

  const findFounderMutation = useMutation({
    mutationFn: (id: string) =>
      api
        .post(`/api/leads/${id}/find-founder`)
        .then((r) => r.data as { found: boolean; name?: string; linkedin_url?: string }),
    onSuccess: (data) => {
      if (data.found) {
        toast.success(`Founder found${data.name ? `: ${data.name}` : ""}`);
        queryClient.invalidateQueries({ queryKey: ["leads"] });
      } else {
        toast.info("No founder found on LinkedIn for this company");
      }
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Founder search failed";
      toast.error(msg);
    },
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Runs one lead at a time (founder + email lookups in parallel per lead) so we
  // don't fan out a burst of concurrent PhantomBuster/Apollo calls across the batch.
  const runBatchLookup = async (ids: string[]) => {
    if (ids.length === 0 || batchLookupIds.size > 0) return;
    setBatchLookupIds(new Set(ids));
    let foundersFound = 0;
    let emailsFound = 0;
    let errors = 0;

    for (const id of ids) {
      const [founderResult, emailResult] = await Promise.allSettled([
        api.post(`/api/leads/${id}/find-founder`).then((r) => r.data as { found?: boolean }),
        api.post(`/api/leads/${id}/find-email`).then((r) => r.data as { email?: string | null }),
      ]);
      if (founderResult.status === "fulfilled" && founderResult.value.found) foundersFound++;
      if (emailResult.status === "fulfilled" && emailResult.value.email) emailsFound++;
      if (founderResult.status === "rejected" && emailResult.status === "rejected") errors++;
      setBatchLookupIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }

    queryClient.invalidateQueries({ queryKey: ["leads"] });
    toast.success(
      `Batch lookup complete: ${foundersFound} founder${foundersFound === 1 ? "" : "s"} found, ${emailsFound} email${emailsFound === 1 ? "" : "s"} found${
        errors ? `, ${errors} lead${errors === 1 ? "" : "s"} failed` : ""
      }`,
    );
  };

  const bulkSetIds = async (ids: string[], status: LeadStatus) => {
    if (ids.length === 0) return;
    const results = await Promise.allSettled(
      ids.map((id) => updateStatusMutation.mutateAsync({ id, status })),
    );
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    if (succeeded) {
      toast.success(`${succeeded} lead${succeeded === 1 ? "" : "s"} ${status.toLowerCase()}`);
    }
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  };

  const bulkDeleteIds = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (
      !confirm(`Delete ${ids.length} lead${ids.length === 1 ? "" : "s"}? This can't be undone.`)
    ) {
      return;
    }
    const results = await Promise.allSettled(ids.map((id) => deleteLeadMutation.mutateAsync(id)));
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    if (succeeded) {
      toast.success(`${succeeded} lead${succeeded === 1 ? "" : "s"} deleted`);
    }
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  };

  return {
    selected,
    setSelected,
    toggleSelect,
    localEmails,
    setLocalEmails,
    batchLookupIds,
    runBatchLookup,
    updateStatusMutation,
    deleteLeadMutation,
    updateEmailMutation,
    findEmailMutation,
    findFounderMutation,
    setLeadStatus: (id: string, status: LeadStatus) => updateStatusMutation.mutate({ id, status }),
    bulkSetIds,
    bulkDeleteIds,
  };
}

export type LeadActions = ReturnType<typeof useLeadActions>;

function LeadTable({ items, actions }: { items: LeadRow[]; actions: LeadActions }) {
  const {
    selected,
    toggleSelect,
    localEmails,
    setLocalEmails,
    batchLookupIds,
    updateEmailMutation,
    findEmailMutation,
    findFounderMutation,
    deleteLeadMutation,
    setLeadStatus,
  } = actions;

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Signal</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Founder</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>LinkedIn</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((l) => (
            <TableRow key={l.id}>
              <TableCell>
                <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggleSelect(l.id)} />
              </TableCell>
              <TableCell className="font-medium">{l.company}</TableCell>
              <TableCell className="max-w-xs text-sm text-muted-foreground">{l.notes}</TableCell>
              <TableCell>
                {l.signalType && (
                  <StatusBadge label={l.signalType} tone={signalTones[l.signalType] ?? "muted"} />
                )}
              </TableCell>
              <TableCell>
                <div className="font-medium">{l.name}</div>
                {l.role && <div className="text-xs text-muted-foreground">{l.role}</div>}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Input
                    className="h-7 w-40 text-sm"
                    placeholder="founder@co.com"
                    value={localEmails[l.id] ?? l.email ?? ""}
                    onChange={(e) =>
                      setLocalEmails((prev) => ({ ...prev, [l.id]: e.target.value }))
                    }
                    onBlur={() => {
                      const val = localEmails[l.id];
                      if (val !== undefined && val !== (l.email ?? "")) {
                        updateEmailMutation.mutate({ id: l.id, email: val });
                      }
                    }}
                  />
                  {l.enrichment_data?.email_source === "apollo" && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Mail className="h-3.5 w-3.5 shrink-0 text-brand-blue" />
                        </TooltipTrigger>
                        <TooltipContent>Email found via Apollo</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                    title="Look up email via Apollo"
                    onClick={() => findEmailMutation.mutate(l.id)}
                    disabled={
                      (findEmailMutation.isPending && findEmailMutation.variables === l.id) ||
                      batchLookupIds.has(l.id)
                    }
                  >
                    {(findEmailMutation.isPending && findEmailMutation.variables === l.id) ||
                    batchLookupIds.has(l.id) ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Search className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </TableCell>
              <TableCell>
                {l.linkedin_url && (
                  <a
                    href={l.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-brand-blue hover:underline"
                  >
                    View
                  </a>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge
                  label={l.status}
                  tone={statusTones[l.status as LeadStatus] ?? "muted"}
                />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {l.created_at?.slice(0, 10)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    title="Find founder via LinkedIn"
                    onClick={() => findFounderMutation.mutate(l.id)}
                    disabled={
                      (findFounderMutation.isPending && findFounderMutation.variables === l.id) ||
                      batchLookupIds.has(l.id)
                    }
                  >
                    {(findFounderMutation.isPending && findFounderMutation.variables === l.id) ||
                    batchLookupIds.has(l.id) ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UserSearch className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Find founder
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-brand-turquoise/40 text-brand-turquoise hover:bg-brand-turquoise/10"
                    onClick={() => setLeadStatus(l.id, "Approved")}
                    disabled={l.status === "Approved" || l.status === "Pushed"}
                  >
                    Approve
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setLeadStatus(l.id, "Skipped")}>
                    Skip
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    title="Delete lead"
                    onClick={() => {
                      if (confirm(`Delete lead "${l.company}"?`)) {
                        deleteLeadMutation.mutate(l.id);
                      }
                    }}
                    disabled={deleteLeadMutation.isPending && deleteLeadMutation.variables === l.id}
                  >
                    {deleteLeadMutation.isPending && deleteLeadMutation.variables === l.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// A titled, collapsible group of leads with select-all and bulk actions.
export function LeadGroup({
  title,
  items,
  actions,
  collapsed,
  onToggleCollapsed,
}: {
  title: string;
  items: LeadRow[];
  actions: LeadActions;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const { selected, setSelected, batchLookupIds, runBatchLookup, bulkSetIds, bulkDeleteIds } =
    actions;
  const groupSelected = items.filter((l) => selected.has(l.id)).map((l) => l.id);
  const allSelected = groupSelected.length === items.length;
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) items.forEach((l) => next.delete(l.id));
      else items.forEach((l) => next.add(l.id));
      return next;
    });
  };

  return (
    <div className="rounded-lg border bg-muted/10 p-4">
      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold ${sectionTone}`}
          >
            {title}
          </span>
          <span className="text-xs text-muted-foreground">
            {items.length} {items.length === 1 ? "lead" : "leads"}
          </span>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="inline-flex items-center gap-0.5 text-xs font-medium text-brand-blue hover:underline"
          >
            {collapsed ? (
              <>
                <ChevronDown className="h-3 w-3" /> Show
              </>
            ) : (
              <>
                <ChevronUp className="h-3 w-3" /> Hide
              </>
            )}
          </button>
        </div>
        {!collapsed && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-brand-turquoise/40 text-brand-turquoise hover:bg-brand-turquoise/10"
              onClick={toggleAll}
            >
              {allSelected ? "Clear all" : "Select all"}
            </Button>
            <span className="text-xs text-muted-foreground">{groupSelected.length} selected</span>
            <Button
              size="sm"
              variant="outline"
              className="border-brand-blue/40 text-brand-blue hover:bg-brand-blue/10"
              disabled={groupSelected.length === 0 || batchLookupIds.size > 0}
              onClick={() => runBatchLookup(groupSelected)}
            >
              {batchLookupIds.size > 0 ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Looking up… ({batchLookupIds.size} left)
                </>
              ) : (
                <>
                  <UserSearch className="mr-1.5 h-3.5 w-3.5" />
                  Find founders & emails
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-brand-turquoise/40 text-brand-turquoise hover:bg-brand-turquoise/10"
              disabled={groupSelected.length === 0}
              onClick={() => bulkSetIds(groupSelected, "Approved")}
            >
              Approve selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-brand-turquoise/40 text-brand-turquoise hover:bg-brand-turquoise/10"
              disabled={groupSelected.length === 0}
              onClick={() => bulkSetIds(groupSelected, "Skipped")}
            >
              Skip selected
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              disabled={groupSelected.length === 0}
              onClick={() => bulkDeleteIds(groupSelected)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete selected
            </Button>
          </div>
        )}
      </div>
      {!collapsed && <LeadTable items={items} actions={actions} />}
    </div>
  );
}
