import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Mail, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import api from "@/lib/api";
import { useStore, store } from "@/lib/store";

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

type Positioning = { id: string; content: string; updated_at: string };

type LeadGroup = {
  lead_id: string;
  lead: { name: string; company: string; email?: string } | undefined;
  drafts: Draft[];
};

function EmailOutreachPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settingsOpen, setSettingsOpen] = useState(true);
  const [positioningText, setPositioningText] = useState("");
  const lemlistSequenceId = useStore((s) => s.emailSettings.lemlistSequenceId);
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);
  // localDrafts: per-draft edits keyed by draft id
  const [localDrafts, setLocalDrafts] = useState<Record<string, { subject: string; body: string }>>({});
  // activeDraft: which draft id is selected per lead group
  const [activeDraft, setActiveDraft] = useState<Record<string, string>>({});

  const { data: positioning } = useQuery<Positioning>({
    queryKey: ["positioning"],
    queryFn: () => api.get("/api/outreach/positioning").then((r) => r.data),
    retry: false,
  });

  useEffect(() => {
    if (positioning?.content && !positioningText) {
      setPositioningText(positioning.content);
    }
  }, [positioning]);

  const { data: drafts = [], isLoading } = useQuery<Draft[]>({
    queryKey: ["drafts"],
    queryFn: () =>
      api.get("/api/outreach/drafts", { params: { status: "draft", limit: 100 } }).then((r) => r.data.data ?? []),
  });

  const { data: approvedLeads = [] } = useQuery({
    queryKey: ["leads", "Approved"],
    queryFn: () =>
      api.get("/api/leads", { params: { status: "Approved", limit: 100 } }).then((r) => r.data.data ?? []),
  });

  // Group drafts by lead, preserving insertion order
  const leadGroups: LeadGroup[] = (() => {
    const map = new Map<string, LeadGroup>();
    for (const d of drafts) {
      if (!map.has(d.lead_id)) {
        map.set(d.lead_id, { lead_id: d.lead_id, lead: d.leads, drafts: [] });
      }
      map.get(d.lead_id)!.drafts.push(d);
    }
    return Array.from(map.values());
  })();

  const draftedLeadIds = new Set(drafts.map((d) => d.lead_id));
  const leadsWithoutDraft = approvedLeads.filter((l: { id: string }) => !draftedLeadIds.has(l.id));

  // For a group, which draft is currently active
  const getActiveDraftId = (group: LeadGroup) =>
    activeDraft[group.lead_id] && group.drafts.find((d) => d.id === activeDraft[group.lead_id])
      ? activeDraft[group.lead_id]
      : group.drafts[0]?.id;

  const getEdited = (draft: Draft) => localDrafts[draft.id] ?? { subject: draft.subject, body: draft.body };

  // Upload positioning file
  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.post("/api/outreach/positioning/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: (res) => {
      setPositioningText(res.data.content);
      setUploadedFilename(res.data.filename);
      toast.success(`Positioning extracted from ${res.data.filename}`);
      queryClient.invalidateQueries({ queryKey: ["positioning"] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Upload failed";
      toast.error(msg);
    },
  });

  const saveTextMutation = useMutation({
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
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to generate draft";
      toast.error(msg);
    },
  });

  const updateDraftMutation = useMutation({
    mutationFn: ({ id, subject, body }: { id: string; subject: string; body: string }) =>
      api.patch(`/api/outreach/drafts/${id}`, { subject, body }),
  });

  const saveEdit = (draft: Draft) => {
    const edited = localDrafts[draft.id];
    if (edited) updateDraftMutation.mutate({ id: draft.id, ...edited });
  };

  const approveMutation = useMutation({
    mutationFn: (draftId: string) => api.post(`/api/outreach/approve/${draftId}`, {}),
    onSuccess: (_res, draftId) => {
      const draft = drafts.find((d) => d.id === draftId);
      const name = draft?.leads?.name ?? "Lead";
      toast.success(`${name} — draft approved. Will push to Lemlist once API key is configured.`);
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Approval failed";
      toast.error(msg);
    },
  });

  const deleteDraftMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/outreach/drafts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["drafts"] }),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = "";
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Email Outreach</h1>
        <p className="text-sm text-muted-foreground">
          Review Claude-drafted emails for approved leads and push them into your Lemlist sequence.
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
            <p className="text-xs text-muted-foreground">Positioning file for Claude context.</p>
          </div>
          {settingsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {settingsOpen && (
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium">Positioning file</label>
              <div className="flex items-center gap-2">
                {uploadedFilename && (
                  <span className="text-xs text-muted-foreground">{uploadedFilename}</span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadMutation.isPending}
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  {uploadMutation.isPending ? "Extracting…" : uploadedFilename ? "Replace file" : "Upload PDF / DOCX"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
            <Textarea
              rows={7}
              placeholder="Paste your positioning here, or upload a PDF/DOCX above."
              value={positioningText}
              onChange={(e) => setPositioningText(e.target.value)}
            />
            <Button
              size="sm"
              className="mt-2"
              variant="outline"
              onClick={() => saveTextMutation.mutate(positioningText)}
              disabled={saveTextMutation.isPending || !positioningText}
            >
              {saveTextMutation.isPending ? "Saving…" : "Save positioning"}
            </Button>

            <div className="mt-5">
              <label className="mb-1.5 block text-xs font-medium">Lemlist sequence ID</label>
              <Input
                placeholder="cam_xxxxxxxxxxxx"
                value={lemlistSequenceId}
                onChange={(e) =>
                  store.set((s) => ({
                    ...s,
                    emailSettings: { ...s.emailSettings, lemlistSequenceId: e.target.value },
                  }))
                }
              />
            </div>
          </div>
        )}
      </Card>

      {/* Approved leads without any draft */}
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
                  <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${generateDraftMutation.isPending ? "animate-spin" : ""}`} />
                  {generateDraftMutation.isPending ? "Drafting…" : "Generate draft"}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Draft review queue */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">
          Draft review queue
          {leadGroups.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {leadGroups.length} lead{leadGroups.length !== 1 ? "s" : ""}
            </span>
          )}
        </h2>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading drafts…</p>
      ) : leadGroups.length === 0 ? (
        <EmptyState
          icon={Mail}
          message="No drafts ready. Approve leads in Lead Discovery first, then generate drafts."
        />
      ) : (
        <div className="space-y-4">
          {leadGroups.map((group) => {
            const activeDraftId = getActiveDraftId(group);
            const activeDraftData = group.drafts.find((d) => d.id === activeDraftId)!;
            const edited = getEdited(activeDraftData);
            const hasMultiple = group.drafts.length > 1;

            return (
              <Card key={group.lead_id} className="p-6">
                {/* Lead header */}
                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{group.lead?.name}</h3>
                    <span className="text-sm text-muted-foreground">· {group.lead?.company}</span>
                  </div>
                  {group.lead?.email && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{group.lead.email}</p>
                  )}
                </div>

                {/* Option tabs — only shown when multiple drafts exist */}
                {hasMultiple && (
                  <div className="mb-4 flex gap-1 rounded-md border p-1 w-fit">
                    {group.drafts.map((d, i) => (
                      <button
                        key={d.id}
                        onClick={() => setActiveDraft((prev) => ({ ...prev, [group.lead_id]: d.id }))}
                        className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                          d.id === activeDraftId
                            ? "bg-foreground text-background"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Option {i + 1}
                      </button>
                    ))}
                  </div>
                )}

                {/* Editable draft */}
                <div className="space-y-2">
                  <Input
                    value={edited.subject}
                    onChange={(e) =>
                      setLocalDrafts((prev) => ({
                        ...prev,
                        [activeDraftId]: { ...getEdited(activeDraftData), subject: e.target.value },
                      }))
                    }
                    onBlur={() => saveEdit(activeDraftData)}
                    placeholder="Subject"
                  />
                  <Textarea
                    rows={8}
                    value={edited.body}
                    onChange={(e) =>
                      setLocalDrafts((prev) => ({
                        ...prev,
                        [activeDraftId]: { ...getEdited(activeDraftData), body: e.target.value },
                      }))
                    }
                    onBlur={() => saveEdit(activeDraftData)}
                  />
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center justify-between">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generateDraftMutation.mutate(group.lead_id)}
                    disabled={generateDraftMutation.isPending}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    {hasMultiple ? "Generate another" : "Regenerate"}
                  </Button>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteDraftMutation.mutate(activeDraftId)}
                      disabled={deleteDraftMutation.isPending}
                    >
                      {hasMultiple ? "Discard this option" : "Skip"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => approveMutation.mutate(activeDraftId)}
                      disabled={approveMutation.isPending}
                    >
                      Approve and push to Lemlist
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
