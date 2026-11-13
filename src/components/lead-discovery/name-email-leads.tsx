import { useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { GroupTitle, ShowMoreToggle, PREVIEW_COUNT } from "@/components/lead-discovery/group-parts";
import { errorMessage } from "@/lib/contacts";
import api from "@/lib/api";

type NameEmailLead = {
  id: string;
  name: string;
  company: string;
  email?: string | null;
  linkedin_url?: string;
  status: string;
  created_at: string;
};

// People searched by name in "email" mode. They are saved as soon as they are found (source
// by_name_email), so this list is what stays after a refresh — kept apart from the LinkedIn leads.
export function useNameEmailLeads() {
  return useQuery<NameEmailLead[]>({
    queryKey: ["leads", "by-name-email"],
    queryFn: () =>
      api
        .get("/api/leads", { params: { source: "by_name_email", limit: 100 } })
        .then((r) => (r.data.data ?? r.data ?? []) as NameEmailLead[]),
  });
}

// Shown in Leads Results next to the LinkedIn list; nothing is shown until there is a lead.
export function NameEmailLeads() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const [localEmails, setLocalEmails] = useState<Record<string, string>>({});
  const [draftingIds, setDraftingIds] = useState<Set<string>>(new Set());
  const [draftedIds, setDraftedIds] = useState<Set<string>>(new Set());

  const { data: leads = [] } = useNameEmailLeads();
  const emailOf = (l: NameEmailLead) => localEmails[l.id] ?? l.email ?? "";

  const saveEmailMutation = useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) =>
      api.patch(`/api/leads/${id}`, { email }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads", "by-name-email"] }),
    onError: () => toast.error("Failed to save email"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/leads/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads", "by-name-email"] }),
    onError: () => toast.error("Failed to delete lead"),
  });

  const writeDraft = async (l: NameEmailLead) => {
    setDraftingIds((prev) => new Set(prev).add(l.id));
    try {
      await api.post("/api/outreach/draft", { lead_id: l.id });
      setDraftedIds((prev) => new Set(prev).add(l.id));
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
      toast.success(`Draft written for ${l.name}`, {
        action: { label: "Review & send", onClick: () => navigate({ to: "/email-outreach" }) },
      });
    } catch (err) {
      toast.error(errorMessage(err, "Failed to write the draft"), { duration: 15000 });
    } finally {
      setDraftingIds((prev) => {
        const next = new Set(prev);
        next.delete(l.id);
        return next;
      });
    }
  };

  if (leads.length === 0) return null;

  const shown = showAll ? leads : leads.slice(0, PREVIEW_COUNT);

  return (
    <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
      <GroupTitle eyebrow="Option 3" title="Leads from name search (email)" count={leads.length} />
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>LinkedIn</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{l.company || "—"}</TableCell>
                <TableCell>
                  {l.linkedin_url ? (
                    <a
                      href={l.linkedin_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-brand-blue hover:underline"
                    >
                      View
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <Input
                    className="h-7 w-52 text-sm"
                    type="email"
                    placeholder="No email found — type one"
                    aria-label={`Email of ${l.name}`}
                    value={emailOf(l)}
                    onChange={(e) =>
                      setLocalEmails((prev) => ({ ...prev, [l.id]: e.target.value }))
                    }
                    onBlur={() => {
                      const val = localEmails[l.id];
                      if (val !== undefined && val !== (l.email ?? "")) {
                        saveEmailMutation.mutate({ id: l.id, email: val });
                      }
                    }}
                  />
                </TableCell>
                <TableCell>
                  <StatusBadge label={l.status} tone="muted" />
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
                      disabled={draftingIds.has(l.id) || !emailOf(l).trim()}
                      title={emailOf(l).trim() ? undefined : "Needs an email address first"}
                      onClick={() => writeDraft(l)}
                    >
                      {draftingIds.has(l.id) ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {draftedIds.has(l.id) ? "Rewrite draft" : "Write draft"}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      title="Delete lead"
                      onClick={() => {
                        if (confirm(`Delete lead "${l.name}"?`)) deleteMutation.mutate(l.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ShowMoreToggle
        total={leads.length}
        expanded={showAll}
        onToggle={() => setShowAll((v) => !v)}
      />
    </div>
  );
}
