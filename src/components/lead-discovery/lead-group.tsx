import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Trash2,
  UserSearch,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { errorMessage, type Contact } from "@/lib/contacts";
import { ConnectionCell } from "@/components/lead-discovery/connection-cell";
import { StickyXScroll } from "@/components/sticky-x-scroll";
import { AddPersonDialog } from "@/components/lead-discovery/add-person-dialog";
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

type SelectResponse = {
  contact: Contact;
  request: { sent: boolean; reason?: "already_connected" | "already_requested"; error?: string };
};

// Per-lead actions (status, delete, email, founder/team lookup, batch lookup, selecting
// people) shared by every lead group on a page. Call once per page and pass the result to
// each <LeadGroup>.
export function useLeadActions() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [localEmails, setLocalEmails] = useState<Record<string, string>>({});
  const [batchLookupIds, setBatchLookupIds] = useState<Set<string>>(new Set());
  const [teamLookupIds, setTeamLookupIds] = useState<Set<string>>(new Set());

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
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
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
    onError: (err: unknown) => toast.error(errorMessage(err, "Apollo lookup failed")),
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
    onError: (err: unknown) => toast.error(errorMessage(err, "Founder search failed")),
  });

  // --- People at each company (founders + executive team) ---

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => api.get("/api/contacts").then((r) => (r.data.data ?? []) as Contact[]),
  });
  const peopleByLead = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const c of contacts) {
      if (c.kind !== "person") continue;
      map.set(c.lead_id, [...(map.get(c.lead_id) ?? []), c]);
    }
    return map;
  }, [contacts]);

  // One lead at a time. The backend finds each company's founders and executives (through Apollo,
  // or a LinkedIn search via Phantombuster when Apollo isn't set up).
  const runFindTeam = async (leadIds: string[]) => {
    if (leadIds.length === 0 || teamLookupIds.size > 0) return;
    setTeamLookupIds(new Set(leadIds));
    let people = 0;
    let errors = 0;
    let unknownConnections = 0;
    let apolloCredits = 0;
    let lastError = "";
    let emptyReason = "";
    let recordNote = "";

    for (const id of leadIds) {
      try {
        const r = await api.post("/api/contacts/find-team", { lead_id: id });
        people += r.data.contacts?.length ?? 0;
        unknownConnections += r.data.unknown_count ?? 0;
        // Say what the search did when it came back empty, instead of a bare "0 found".
        const s = r.data.search as
          | {
              source?: string;
              searched_for: string;
              raw: number;
              phantom_output?: string;
              org_found?: boolean;
              org_name?: string | null;
              org_candidates?: string[];
              credits_estimate?: number;
              org_domain?: string | null;
              org_matches?: number;
              from_cache?: boolean;
              tried?: { steps: { listed?: number; titles?: string[] }[] }[];
            }
          | undefined;
        if (s?.source === "apollo" && !s.from_cache) apolloCredits += s.credits_estimate ?? 0;
        // Which Apollo company the people came from, so a same-name company can be spotted.
        if (
          s?.source === "apollo" &&
          leadIds.length === 1 &&
          s.org_name &&
          r.data.contacts?.length > 0
        ) {
          recordNote = `People came from Apollo's “${s.org_name}”${s.org_domain ? ` (${s.org_domain})` : ""}.${(s.org_matches ?? 1) > 1 ? ` Apollo has ${s.org_matches} companies with this name, so check it's the right one before selecting anyone.` : ""}`;
        }
        if (s && !(r.data.contacts?.length > 0)) {
          if (s.source === "apollo") {
            emptyReason = !s.org_found
              ? `Apollo has no company called “${s.searched_for}”${s.org_candidates?.length ? ` (closest: ${s.org_candidates.slice(0, 3).join(", ")})` : ""}.`
              : s.raw === 0
                ? (() => {
                    // How many people Apollo lists for the company at all, across everything we tried.
                    const listed = Math.max(
                      0,
                      ...(s.tried ?? []).flatMap((t) => t.steps.map((st) => st.listed ?? 0)),
                    );
                    // A few of the titles Apollo has for them, to show why none counted as leadership.
                    const titles = (s.tried ?? [])
                      .flatMap((t) => t.steps.flatMap((st) => st.titles ?? []))
                      .slice(0, 6);
                    return `Apollo knows “${s.org_name}” but ${listed ? `lists ${listed} ${listed === 1 ? "person" : "people"} for it, none with a founder or executive title${titles.length ? ` (titles include: ${titles.join(", ")})` : ""}` : "lists no people for it at all"}.`;
                  })()
                : `Apollo lists ${s.raw} founder${s.raw === 1 ? "" : "s"}/executive${s.raw === 1 ? "" : "s"} at “${s.org_name}”, but none had a LinkedIn profile.`;
          } else {
            emptyReason =
              s.raw === 0
                ? `LinkedIn returned no results for “${s.searched_for}”.${s.phantom_output ? ` PhantomBuster reported: ${s.phantom_output}` : ""}`
                : `LinkedIn returned ${s.raw} result${s.raw === 1 ? "" : "s"} for “${s.searched_for}”, but none looked like a current founder or executive of that company.`;
          }
        }
      } catch (err) {
        errors++;
        lastError = errorMessage(err, "Couldn't reach the backend — check your connection");
      }
      setTeamLookupIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    }

    const summary = `${people} ${people === 1 ? "person" : "people"} found${errors ? `, ${errors} search${errors === 1 ? "" : "es"} failed` : ""}${apolloCredits ? ` · about ${apolloCredits} Apollo credit${apolloCredits === 1 ? "" : "s"} used` : ""}`;
    // Show the backend's actual reason (e.g. an expired LinkedIn session) and keep it up long
    // enough to read and copy.
    if (people === 0 && errors)
      toast.error(`Team search failed: ${lastError}`, { duration: 20000 });
    else if (people === 0 && emptyReason)
      toast.info(`No people found. ${emptyReason}`, { duration: 20000 });
    else toast.success(summary);
    if (recordNote) toast.info(recordNote, { duration: 15000 });
    if (unknownConnections > 0) {
      toast.info(
        `${unknownConnections} ${unknownConnections === 1 ? "connection" : "connections"} couldn't be confirmed from the search. Click “Refresh connections” to check them against your LinkedIn connections list.`,
        { duration: 10000 },
      );
    }
  };

  const checkConnectionsMutation = useMutation({
    mutationFn: (leadIds: string[]) =>
      api
        .post("/api/contacts/check-connections", { refresh: true, lead_ids: leadIds })
        .then((r) => r.data as { checked: number; connections_available: boolean }),
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      if (d.connections_available) toast.success(`Connections refreshed for ${d.checked} people`);
      else toast.info("Couldn't verify connections — the Connections Export agent isn't available");
    },
    onError: (err: unknown) => toast.error(errorMessage(err, "Connection check failed")),
  });

  // Selecting a person approves their lead and sends a LinkedIn connection request
  // (skipped when already connected or already requested).
  const selectContactMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/api/contacts/${id}/select`).then((r) => r.data as SelectResponse),
    onSuccess: ({ contact, request }) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      if (request.sent) toast.success(`Connection request sent to ${contact.name}`);
      else if (request.reason === "already_connected")
        toast.success(`${contact.name} selected — already connected`);
      else if (request.reason === "already_requested")
        toast.info(`${contact.name} selected — a connection request was already sent`);
      else
        toast.error(
          `${contact.name} selected, but the connection request failed: ${request.error ?? "unknown error"}`,
        );
    },
    onError: (err: unknown) => toast.error(errorMessage(err, "Failed to select")),
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
    let lastError = "";

    for (const id of ids) {
      const [founderResult, emailResult] = await Promise.allSettled([
        api.post(`/api/leads/${id}/find-founder`).then((r) => r.data as { found?: boolean }),
        api.post(`/api/leads/${id}/find-email`).then((r) => r.data as { email?: string | null }),
      ]);
      if (founderResult.status === "fulfilled" && founderResult.value.found) foundersFound++;
      if (emailResult.status === "fulfilled" && emailResult.value.email) emailsFound++;
      if (founderResult.status === "rejected" && emailResult.status === "rejected") errors++;
      if (founderResult.status === "rejected") {
        lastError = errorMessage(founderResult.reason, "Founder search failed");
      }
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
    // A "0 found" that's really a failure should say why.
    if (foundersFound === 0 && lastError) {
      toast.error(`Founder search failed: ${lastError}`, { duration: 20000 });
    }
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
    teamLookupIds,
    runFindTeam,
    peopleByLead,
    checkConnectionsMutation,
    selectContactMutation,
    updateStatusMutation,
    deleteLeadMutation,
    updateEmailMutation,
    findEmailMutation,
    findFounderMutation,
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
    teamLookupIds,
    runFindTeam,
    peopleByLead,
    selectContactMutation,
    updateEmailMutation,
    findEmailMutation,
    findFounderMutation,
    deleteLeadMutation,
    updateStatusMutation,
  } = actions;

  return (
    <StickyXScroll>
      <Table containerClassName="overflow-visible">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Signal</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Founders &amp; team</TableHead>
            <TableHead>Connection</TableHead>
            <TableHead>LinkedIn</TableHead>
            <TableHead></TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((l) => {
            const people = peopleByLead.get(l.id) ?? [];
            const rows: (Contact | null)[] = people.length ? people : [null];
            const span = rows.length;
            const findingFounder =
              (findFounderMutation.isPending && findFounderMutation.variables === l.id) ||
              batchLookupIds.has(l.id);
            const findingTeam = teamLookupIds.has(l.id);

            return rows.map((p, i) => (
              <TableRow key={`${l.id}-${p?.id ?? "none"}`}>
                {i === 0 && (
                  <>
                    <TableCell rowSpan={span}>
                      <Checkbox
                        checked={selected.has(l.id)}
                        onCheckedChange={() => toggleSelect(l.id)}
                      />
                    </TableCell>
                    <TableCell rowSpan={span} className="font-medium">
                      {l.company}
                    </TableCell>
                    <TableCell rowSpan={span} className="max-w-xs text-sm text-muted-foreground">
                      {l.notes}
                    </TableCell>
                    <TableCell rowSpan={span}>
                      {l.signalType && (
                        <StatusBadge
                          label={l.signalType}
                          tone={signalTones[l.signalType] ?? "muted"}
                        />
                      )}
                    </TableCell>
                  </>
                )}

                {/* One row per founder / executive */}
                <TableCell>
                  <div className="font-medium">{p ? p.name : l.name}</div>
                  {(p ? p.role : l.role) && (
                    <div className="text-xs text-muted-foreground">{p ? p.role : l.role}</div>
                  )}
                  {!p && (
                    <div className="text-xs text-muted-foreground/70">
                      Use “Find team” to list the founders and executives
                    </div>
                  )}
                </TableCell>
                <TableCell>{p ? <ConnectionCell contact={p} /> : "—"}</TableCell>
                <TableCell>
                  {(p ? p.linkedin_url : l.linkedin_url) && (
                    <a
                      href={(p ? p.linkedin_url : l.linkedin_url) ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-brand-blue hover:underline"
                    >
                      View
                    </a>
                  )}
                </TableCell>
                <TableCell>
                  {p && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-brand-turquoise/40 text-brand-turquoise hover:bg-brand-turquoise/10"
                      title={
                        p.selected
                          ? "Selected"
                          : "Select — sends a LinkedIn connection request unless you're already connected"
                      }
                      disabled={
                        p.selected ||
                        (selectContactMutation.isPending &&
                          selectContactMutation.variables === p.id)
                      }
                      onClick={() => selectContactMutation.mutate(p.id)}
                    >
                      {selectContactMutation.isPending &&
                      selectContactMutation.variables === p.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : p.selected ? (
                        <>
                          <Check className="mr-1 h-3.5 w-3.5" /> Selected
                        </>
                      ) : (
                        "Select"
                      )}
                    </Button>
                  )}
                </TableCell>

                {i === 0 && (
                  <>
                    <TableCell rowSpan={span}>
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
                    <TableCell rowSpan={span}>
                      <StatusBadge
                        label={l.status}
                        tone={statusTones[l.status as LeadStatus] ?? "muted"}
                      />
                    </TableCell>
                    <TableCell rowSpan={span} className="text-sm text-muted-foreground">
                      {l.created_at?.slice(0, 10)}
                    </TableCell>
                    <TableCell rowSpan={span} className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          title="Find the founders and executive team on LinkedIn"
                          onClick={() => runFindTeam([l.id])}
                          disabled={teamLookupIds.size > 0}
                        >
                          {findingTeam ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Users className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Find team
                        </Button>
                        <AddPersonDialog leadId={l.id} company={l.company} />
                        <Button
                          size="sm"
                          variant="outline"
                          title="Find founder via LinkedIn"
                          onClick={() => findFounderMutation.mutate(l.id)}
                          disabled={findingFounder}
                        >
                          {findingFounder ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UserSearch className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Find founder
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            updateStatusMutation.mutate({ id: l.id, status: "Skipped" })
                          }
                        >
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
                          disabled={
                            deleteLeadMutation.isPending && deleteLeadMutation.variables === l.id
                          }
                        >
                          {deleteLeadMutation.isPending && deleteLeadMutation.variables === l.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </>
                )}
              </TableRow>
            ));
          })}
        </TableBody>
      </Table>
    </StickyXScroll>
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
  const {
    selected,
    setSelected,
    batchLookupIds,
    runBatchLookup,
    teamLookupIds,
    runFindTeam,
    checkConnectionsMutation,
    bulkSetIds,
    bulkDeleteIds,
  } = actions;
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
              className="border-brand-blue/40 text-brand-blue hover:bg-brand-blue/10"
              disabled={groupSelected.length === 0 || teamLookupIds.size > 0}
              onClick={() => runFindTeam(groupSelected)}
            >
              {teamLookupIds.size > 0 ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Finding teams… ({teamLookupIds.size} left)
                </>
              ) : (
                <>
                  <Users className="mr-1.5 h-3.5 w-3.5" />
                  Find teams
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              title="Re-check which people you're connected to on LinkedIn"
              disabled={checkConnectionsMutation.isPending}
              onClick={() => checkConnectionsMutation.mutate(items.map((l) => l.id))}
            >
              {checkConnectionsMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              Refresh connections
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
