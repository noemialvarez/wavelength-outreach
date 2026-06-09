import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ChevronUp, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import api from "@/lib/api";

export const Route = createFileRoute("/_app/email-outreach")({
  head: () => ({ meta: [{ title: "Email Outreach — Wavelength" }] }),
  component: EmailOutreachPage,
});

type Draft = {
  id: string;
  lead_id: string;
  subject: string;
  body: string;
  status: string;
  leads?: { name: string; company: string; email?: string };
};

function EmailOutreachPage() {
  const queryClient = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [positioningContent, setPositioningContent] = useState("");
  const [localDrafts, setLocalDrafts] = useState<Record<string, { subject: string; body: string }>>({});

  // Fetch positioning
  const { data: positioning } = useQuery<{ content: string }>({
    queryKey: ["positioning"],
    queryFn: () => api.get("/api/outreach/positioning").then((r) => r.data),
  });

  // Fetch drafts (pending review)
  const { data: drafts = [], isLoading } = useQuery<Draft[]>({
    queryKey: ["drafts"],
    queryFn: () => api.get("/api/outreach/drafts", { params: { status: "draft", limit: 100 } }).then((r) => r.data.data ?? []),
  });

  // Fetch approved leads (to allow generating new drafts)
  const { data: approvedLeads = [] } = useQuery({
    queryKey: ["leads", "Approved"],
    queryFn: () => api.get("/api/leads", { params: { status: "Approved", limit: 100 } }).then((r) => r.data.data ?? []),
  });

  const draftedLeadIds = new Set(drafts.map((d) => d.lead_id));
  const leadsWithoutDraft = approvedLeads.filter((l: { id: string }) => !draftedLeadIds.has(l.id));

  const savePositioningMutation = useMutation({
    mutationFn: (content: string) => api.put("/api/outreach/positioning", { content }),
    onSuccess: () => {
      toast.success("Positioning saved");
      queryClient.invalidateQueries({ queryKey: ["positioning"] });
    },
    onError: () => toast.error("Failed to save positioning"),
  });

  const generateDraftMutation = useMutation({
    mutationFn: (lead_id: string) => api.post("/api/outreach/draft", { lead_id }),
    onSuccess: () => {
      toast.success("Draft generated");
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
    },
    onError: () => toast.error("Failed to generate draft — is positioning set?"),
  });

  const updateDraftMutation = useMutation({
    mutationFn: ({ id, subject, body }: { id: string; subject: string; body: string }) =>
      api.patch(`/api/outreach/drafts/${id}`, { subject, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["drafts"] }),
  });

  const approveMutation = useMutation({
    mutationFn: (draftId: string) => api.post(`/api/outreach/approve/${draftId}`),
    onSuccess: (_, draftId) => {
      const draft = drafts.find((d) => d.id === draftId);
      toast.success(`${draft?.leads?.company ?? "Lead"} pushed to Lemlist`);
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: () => toast.error("Failed to push to Lemlist"),
  });

  const deleteDraftMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/outreach/drafts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["drafts"] }),
  });

  const getEdited = (draft: Draft) => localDrafts[draft.id] ?? { subject: draft.subject, body: draft.body };

  const saveEdit = (draft: Draft) => {
    const edited = localDrafts[draft.id];
    if (edited) updateDraftMutation.mutate({ id: draft.id, ...edited });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Email Outreach</h1>
        <p className="text-sm text-muted-foreground">
          Review drafted emails for approved leads and push them into your sequence.
        </p>
      </div>

      {/* Settings */}
      <Card className="p-6">
        <button
          className="flex w-full items-center justify-between"
          onClick={() => setSettingsOpen((o) => !o)}
        >
          <div className="text-left">
            <h2 className="text-base font-semibold">Settings</h2>
            <p className="text-xs text-muted-foreground">Positioning and tone for Claude drafts.</p>
          </div>
          {settingsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {settingsOpen && (
          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium">Positioning / about you</label>
              <Textarea
                rows={6}
                placeholder="Describe who you are, what you do, and why founders should talk to you. Claude uses this to personalise every email."
                value={positioningContent || (positioning as { content?: string })?.content || ""}
                onChange={(e) => setPositioningContent(e.target.value)}
              />
            </div>
            <Button
              onClick={() => savePositioningMutation.mutate(positioningContent)}
              disabled={savePositioningMutation.isPending}
            >
              Save positioning
            </Button>
          </div>
        )}
      </Card>

      {/* Approved leads without a draft */}
      {leadsWithoutDraft.length > 0 && (
        <Card className="p-6">
          <h2 className="mb-3 text-base font-semibold">Approved — no draft yet</h2>
          <div className="space-y-2">
            {leadsWithoutDraft.map((l: { id: string; name: string; company: string }) => (
              <div key={l.id} className="flex items-center justify-between rounded-md border px-4 py-3">
                <div>
                  <span className="font-medium">{l.name}</span>
                  <span className="ml-2 text-sm text-muted-foreground">· {l.company}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generateDraftMutation.mutate(l.id)}
                  disabled={generateDraftMutation.isPending}
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Generate draft
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Draft review queue */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Draft review queue</h2>
        <Button
          onClick={() => drafts.forEach((d) => approveMutation.mutate(d.id))}
          disabled={drafts.length === 0 || approveMutation.isPending}
        >
          Push all
          <Badge variant="secondary" className="ml-2 bg-white/20 text-primary-foreground">
            {drafts.length}
          </Badge>
        </Button>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading drafts…</p>
      ) : drafts.length === 0 ? (
        <EmptyState icon={Mail} message="No drafts ready. Approve leads in Lead Discovery first, then generate drafts." />
      ) : (
        <div className="space-y-4">
          {drafts.map((d) => {
            const edited = getEdited(d);
            return (
              <Card key={d.id} className="p-6">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{d.leads?.name}</h3>
                      <span className="text-sm text-muted-foreground">· {d.leads?.company}</span>
                    </div>
                  </div>
                  <StatusBadge label="Draft" tone="muted" />
                </div>
                <div className="space-y-2">
                  <Input
                    value={edited.subject}
                    onChange={(e) =>
                      setLocalDrafts((prev) => ({
                        ...prev,
                        [d.id]: { ...getEdited(d), subject: e.target.value },
                      }))
                    }
                    onBlur={() => saveEdit(d)}
                    placeholder="Subject"
                  />
                  <Textarea
                    rows={8}
                    value={edited.body}
                    onChange={(e) =>
                      setLocalDrafts((prev) => ({
                        ...prev,
                        [d.id]: { ...getEdited(d), body: e.target.value },
                      }))
                    }
                    onBlur={() => saveEdit(d)}
                  />
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-brand-turquoise/40 text-brand-turquoise hover:bg-brand-turquoise/10"
                    onClick={() => generateDraftMutation.mutate(d.lead_id)}
                    disabled={generateDraftMutation.isPending}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Regenerate
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteDraftMutation.mutate(d.id)}>
                    Skip
                  </Button>
                  <Button size="sm" onClick={() => approveMutation.mutate(d.id)} disabled={approveMutation.isPending}>
                    Approve and push to Lemlist
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
