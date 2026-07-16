import { useState } from "react";
import { Search, Loader2, RefreshCw, Send, Mail } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import api from "@/lib/api";

type EscalationLead = {
  id: string;
  name: string;
  company: string;
  email?: string;
};

type Draft = { id: string; lead_id: string; subject: string; body: string };

export function EmailEscalation() {
  const queryClient = useQueryClient();
  const [localEmails, setLocalEmails] = useState<Record<string, string>>({});
  const [localDrafts, setLocalDrafts] = useState<Record<string, { subject: string; body: string }>>(
    {},
  );

  const { data: leads = [], isLoading } = useQuery<EscalationLead[]>({
    queryKey: ["leads", "email-escalation"],
    queryFn: () =>
      api
        .get("/api/leads", { params: { stage: "email_escalation", limit: 100 } })
        .then((r) => (r.data.data ?? r.data ?? []) as EscalationLead[]),
  });

  const leadIds = leads.map((l) => l.id).join(",");
  const { data: drafts = [] } = useQuery<Draft[]>({
    queryKey: ["drafts", "email-escalation", leadIds],
    queryFn: () =>
      api
        .get("/api/outreach/drafts", { params: { lead_ids: leadIds, status: "draft", limit: 100 } })
        .then((r) => (r.data.data ?? []) as Draft[]),
    enabled: leads.length > 0,
  });

  const findEmailMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/api/leads/${id}/find-email`).then((r) => r.data as { email: string | null }),
    onSuccess: (data, id) => {
      if (data.email) {
        setLocalEmails((prev) => ({ ...prev, [id]: data.email! }));
        toast.success(`Email found: ${data.email}`);
        queryClient.invalidateQueries({ queryKey: ["leads", "email-escalation"] });
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

  const generateDraftMutation = useMutation({
    mutationFn: (lead_id: string) => api.post("/api/outreach/draft", { lead_id }),
    onSuccess: () => {
      toast.success("Draft generated");
      queryClient.invalidateQueries({ queryKey: ["drafts", "email-escalation"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Failed to generate draft";
      toast.error(msg);
    },
  });

  const updateDraftMutation = useMutation({
    mutationFn: ({ id, subject, body }: { id: string; subject: string; body: string }) =>
      api.patch(`/api/outreach/drafts/${id}`, { subject, body }),
  });

  const approveMutation = useMutation({
    mutationFn: (draftId: string) => api.post(`/api/outreach/approve/${draftId}`, {}),
    onSuccess: (res, draftId) => {
      const draft = drafts.find((d) => d.id === draftId);
      const lead = leads.find((l) => l.id === draft?.lead_id);
      const pushed: boolean = res.data?.pushed;
      const skipReason: string | undefined = res.data?.lemlist?.reason;
      if (pushed) {
        toast.success(`${lead?.name ?? "Lead"} — pushed to Lemlist`);
      } else {
        toast.info(
          `${lead?.name ?? "Lead"} — approved but not pushed: ${skipReason ?? "check Railway logs"}`,
        );
      }
      queryClient.invalidateQueries({ queryKey: ["drafts", "email-escalation"] });
    },
    onError: () => toast.error("Approval failed"),
  });

  const getEdited = (draft: Draft) =>
    localDrafts[draft.id] ?? { subject: draft.subject, body: draft.body };
  const draftFor = (leadId: string) => drafts.find((d) => d.lead_id === leadId);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Still no reply — escalate to email</h3>
        <p className="text-xs text-muted-foreground">
          Reminder sent with no response — find an email via Apollo and draft an outreach email.
        </p>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
      ) : leads.length === 0 ? (
        <EmptyState icon={Mail} message="No leads need email escalation right now." />
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((l) => {
                  const email = localEmails[l.id] ?? l.email ?? "";
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l.company}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            className="h-7 w-40 text-sm"
                            placeholder="founder@co.com"
                            value={email}
                            readOnly
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                            title="Look up email via Apollo"
                            onClick={() => findEmailMutation.mutate(l.id)}
                            disabled={
                              findEmailMutation.isPending && findEmailMutation.variables === l.id
                            }
                          >
                            {findEmailMutation.isPending && findEmailMutation.variables === l.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Search className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            !email ||
                            (generateDraftMutation.isPending &&
                              generateDraftMutation.variables === l.id)
                          }
                          onClick={() => generateDraftMutation.mutate(l.id)}
                        >
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                          {draftFor(l.id) ? "Regenerate email" : "Draft email"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {drafts.length > 0 && (
            <div className="space-y-4">
              {drafts.map((draft) => {
                const lead = leads.find((l) => l.id === draft.lead_id);
                const edited = getEdited(draft);
                return (
                  <div key={draft.id} className="space-y-2 rounded-md border bg-card p-4">
                    <div className="text-sm font-semibold">{lead?.name ?? "Lead"}</div>
                    <Input
                      value={edited.subject}
                      onChange={(e) =>
                        setLocalDrafts((prev) => ({
                          ...prev,
                          [draft.id]: { ...getEdited(draft), subject: e.target.value },
                        }))
                      }
                      onBlur={() => {
                        const val = localDrafts[draft.id];
                        if (val) updateDraftMutation.mutate({ id: draft.id, ...val });
                      }}
                      placeholder="Subject"
                    />
                    <Textarea
                      rows={6}
                      value={edited.body}
                      onChange={(e) =>
                        setLocalDrafts((prev) => ({
                          ...prev,
                          [draft.id]: { ...getEdited(draft), body: e.target.value },
                        }))
                      }
                      onBlur={() => {
                        const val = localDrafts[draft.id];
                        if (val) updateDraftMutation.mutate({ id: draft.id, ...val });
                      }}
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => approveMutation.mutate(draft.id)}
                        disabled={approveMutation.isPending}
                      >
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                        Approve &amp; push to Lemlist
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
