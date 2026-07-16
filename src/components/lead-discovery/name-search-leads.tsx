import { useState } from "react";
import { Loader2, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import api from "@/lib/api";

type NameSearchLead = {
  id: string;
  name: string;
  company: string;
  linkedin_url?: string;
  status: string;
  created_at: string;
};

const statusTones: Record<string, "turquoise" | "pink" | "blue" | "muted"> = {
  "Pending review": "muted",
  Approved: "turquoise",
  Skipped: "muted",
  Pushed: "blue",
};

// Self-contained — deliberately doesn't reuse the shared Leads Results table:
// leads found via Option 4 are already the named target person, so unlike
// the other sections there's no "Find founder" or Apollo email lookup here.
export function NameSearchLeads() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: leads = [], isLoading } = useQuery<NameSearchLead[]>({
    queryKey: ["leads", "by-name"],
    queryFn: () =>
      api
        .get("/api/leads", { params: { source: "by_name", limit: 100 } })
        .then((r) => (r.data.data ?? r.data ?? []) as NameSearchLead[]),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/leads/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads", "by-name"] }),
    onError: () => toast.error("Failed to update lead status"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/leads/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads", "by-name"] }),
    onError: () => toast.error("Failed to delete lead"),
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(leads.map((l) => l.id)));

  const bulkSetStatus = async (ids: string[], status: string) => {
    if (ids.length === 0) return;
    const results = await Promise.allSettled(
      ids.map((id) => updateStatusMutation.mutateAsync({ id, status })),
    );
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    if (succeeded)
      toast.success(`${succeeded} lead${succeeded === 1 ? "" : "s"} ${status.toLowerCase()}`);
    setSelected(new Set());
  };

  const bulkDelete = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} lead${ids.length === 1 ? "" : "s"}? This can't be undone.`))
      return;
    const results = await Promise.allSettled(ids.map((id) => deleteMutation.mutateAsync(id)));
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    if (succeeded) toast.success(`${succeeded} lead${succeeded === 1 ? "" : "s"} deleted`);
    setSelected(new Set());
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Leads from Name Search</h3>
        <p className="text-xs text-muted-foreground">
          {leads.length} {leads.length === 1 ? "lead" : "leads"}
        </p>
      </div>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : leads.length === 0 ? (
        <EmptyState icon={Users} message="No leads from name search yet." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 p-3">
            <Button
              size="sm"
              variant="outline"
              className="border-brand-turquoise/40 text-brand-turquoise hover:bg-brand-turquoise/10"
              onClick={toggleAll}
            >
              {allSelected ? "Clear all" : "Select all"}
            </Button>
            <span className="text-xs text-muted-foreground">{selected.size} selected</span>
            <Button
              size="sm"
              variant="outline"
              className="border-brand-turquoise/40 text-brand-turquoise hover:bg-brand-turquoise/10"
              disabled={selected.size === 0}
              onClick={() => bulkSetStatus(Array.from(selected), "Approved")}
            >
              Approve selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-brand-turquoise/40 text-brand-turquoise hover:bg-brand-turquoise/10"
              disabled={selected.size === 0}
              onClick={() => bulkSetStatus(Array.from(selected), "Skipped")}
            >
              Skip selected
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              disabled={selected.size === 0}
              onClick={() => bulkDelete(Array.from(selected))}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete selected
            </Button>
          </div>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>LinkedIn</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(l.id)}
                        onCheckedChange={() => toggleSelect(l.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {l.company || "—"}
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
                      <StatusBadge label={l.status} tone={statusTones[l.status] ?? "muted"} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {l.created_at?.slice(0, 10)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-brand-turquoise/40 text-brand-turquoise hover:bg-brand-turquoise/10"
                          onClick={() =>
                            updateStatusMutation.mutate({ id: l.id, status: "Approved" })
                          }
                          disabled={l.status === "Approved" || l.status === "Pushed"}
                        >
                          Approve
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
                            if (confirm(`Delete lead "${l.name}"?`)) deleteMutation.mutate(l.id);
                          }}
                          disabled={deleteMutation.isPending && deleteMutation.variables === l.id}
                        >
                          {deleteMutation.isPending && deleteMutation.variables === l.id ? (
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
        </>
      )}
    </div>
  );
}
