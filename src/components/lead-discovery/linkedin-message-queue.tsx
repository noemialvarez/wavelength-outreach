import { useState } from "react";
import { RefreshCw, Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { CollapsibleSection } from "@/components/lead-discovery/collapsible-section";
import api from "@/lib/api";

type ReadyLead = {
  id: string;
  name: string;
  company: string;
  linkedin_url?: string;
  purpose_of_contact?: string;
  linkedin_message_draft?: string | null;
};

export function LinkedinMessageQueue() {
  const queryClient = useQueryClient();
  const [localDrafts, setLocalDrafts] = useState<Record<string, string>>({});

  const { data: leads = [], isLoading } = useQuery<ReadyLead[]>({
    queryKey: ["leads", "linkedin-ready"],
    queryFn: () =>
      api
        .get("/api/leads", { params: { linkedin_message_status: "ready", limit: 100 } })
        .then((r) => (r.data.data ?? r.data ?? []) as ReadyLead[]),
  });

  const draftMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/leads/${id}/linkedin-message/draft`),
    onSuccess: () => {
      toast.success("Message drafted");
      queryClient.invalidateQueries({ queryKey: ["leads", "linkedin-ready"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Failed to draft LinkedIn message";
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api.patch(`/api/leads/${id}/linkedin-message`, { body }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/leads/${id}/linkedin-message/approve`),
    onSuccess: (_res, id) => {
      const lead = leads.find((l) => l.id === id);
      toast.success(`${lead?.name ?? "Lead"} — message sent`);
      queryClient.invalidateQueries({ queryKey: ["leads", "linkedin-ready"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Approval failed";
      toast.error(msg);
    },
  });

  const getBody = (l: ReadyLead) => localDrafts[l.id] ?? l.linkedin_message_draft ?? "";

  return (
    <CollapsibleSection
      title="LinkedIn message queue"
      description="Connections accepted 4h+ ago — draft a personalized message and send it on LinkedIn."
      badge={
        leads.length > 0 && (
          <span className="text-xs font-normal text-muted-foreground">{leads.length} ready</span>
        )
      }
    >
      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          message="No LinkedIn connections ready for outreach yet."
        />
      ) : (
        <div className="space-y-4">
          {leads.map((l) => (
            <div key={l.id} className="space-y-3 rounded-md border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{l.name}</div>
                  <div className="text-xs text-muted-foreground">{l.company}</div>
                  {l.purpose_of_contact && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Purpose: {l.purpose_of_contact}
                    </div>
                  )}
                </div>
                {l.linkedin_url && (
                  <a
                    href={l.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-brand-blue hover:underline"
                  >
                    View profile
                  </a>
                )}
              </div>
              <Textarea
                rows={5}
                value={getBody(l)}
                placeholder="No draft yet — click Generate draft."
                onChange={(e) => setLocalDrafts((prev) => ({ ...prev, [l.id]: e.target.value }))}
                onBlur={() => {
                  const body = localDrafts[l.id];
                  if (body !== undefined && body !== (l.linkedin_message_draft ?? "")) {
                    updateMutation.mutate({ id: l.id, body });
                  }
                }}
              />
              <div className="flex items-center justify-between">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => draftMutation.mutate(l.id)}
                  disabled={draftMutation.isPending && draftMutation.variables === l.id}
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  {l.linkedin_message_draft ? "Regenerate" : "Generate draft"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => approveMutation.mutate(l.id)}
                  disabled={
                    !getBody(l).trim() ||
                    (approveMutation.isPending && approveMutation.variables === l.id)
                  }
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Approve &amp; send
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
