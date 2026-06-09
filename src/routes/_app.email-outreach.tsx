import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ChevronUp, Mail, Upload, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { store, useStore, generateDraft, uid } from "@/lib/store";

export const Route = createFileRoute("/_app/email-outreach")({
  head: () => ({ meta: [{ title: "Email Outreach — InsightSphere" }] }),
  component: EmailOutreachPage,
});

function EmailOutreachPage() {
  const settings = useStore((s) => s.emailSettings);
  const leads = useStore((s) => s.leads);
  const approved = leads.filter((l) => l.status === "Approved");

  const [open, setOpen] = useState(true);
  const [draftSettings, setDraftSettings] = useState(settings);

  const updateLead = (id: string, patch: Partial<(typeof leads)[number]>) =>
    store.set((s) => ({
      ...s,
      leads: s.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));

  const pushLead = (id: string) => {
    const l = leads.find((x) => x.id === id);
    if (!l) return;
    store.set((s) => ({
      ...s,
      leads: s.leads.map((x) => (x.id === id ? { ...x, status: "Pushed" } : x)),
      sequences: [
        {
          id: uid(),
          leadName: l.founderName,
          company: l.company,
          step: 1,
          lastActivity: "Just queued",
          status: "Active",
        },
        ...s.sequences,
      ],
    }));
    toast.success(`${l.company} pushed to Lemlist`);
  };

  const pushAll = () => {
    const count = approved.length;
    approved.forEach((l) => pushLead(l.id));
    toast.success(`${count} leads pushed to Lemlist`);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Email Outreach</h1>
        <p className="text-sm text-muted-foreground">
          Review drafted emails for approved leads and push them into your sequence.
        </p>
      </div>

      <Card className="p-6">
        <button
          className="flex w-full items-center justify-between"
          onClick={() => setOpen((o) => !o)}
        >
          <div className="text-left">
            <h2 className="text-base font-semibold">Settings</h2>
            <p className="text-xs text-muted-foreground">Positioning, tone, and Lemlist sequence.</p>
          </div>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {open && (
          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium">Positioning file</label>
              <div className="flex items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm hover:bg-muted">
                  <Upload className="h-4 w-4" />
                  {draftSettings.positioningFileName ? "Replace file" : "Upload file"}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) =>
                      setDraftSettings((s) => ({
                        ...s,
                        positioningFileName: e.target.files?.[0]?.name ?? s.positioningFileName,
                      }))
                    }
                  />
                </label>
                {draftSettings.positioningFileName && (
                  <Badge variant="secondary">{draftSettings.positioningFileName}</Badge>
                )}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Email tone and style notes</label>
              <Textarea
                rows={3}
                value={draftSettings.toneNotes}
                onChange={(e) => setDraftSettings((s) => ({ ...s, toneNotes: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Lemlist sequence ID</label>
              <Input
                value={draftSettings.lemlistSequenceId}
                onChange={(e) =>
                  setDraftSettings((s) => ({ ...s, lemlistSequenceId: e.target.value }))
                }
                placeholder="seq_abc123"
              />
            </div>
            <Button
              onClick={() => {
                store.set((s) => ({ ...s, emailSettings: draftSettings }));
                toast.success("Settings saved");
              }}
            >
              Save settings
            </Button>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Draft review queue</h2>
        <Button onClick={pushAll} disabled={approved.length === 0}>
          Push all approved
          <Badge variant="secondary" className="ml-2 bg-white/20 text-primary-foreground">
            {approved.length}
          </Badge>
        </Button>
      </div>

      {approved.length === 0 ? (
        <EmptyState
          icon={Mail}
          message="No drafts ready. Approve leads in Lead Discovery first."
        />
      ) : (
        <div className="space-y-4">
          {approved.map((l) => (
            <Card key={l.id} className="p-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{l.founderName}</h3>
                    <span className="text-sm text-muted-foreground">· {l.company}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{l.signalSummary}</p>
                </div>
                <StatusBadge label={l.signalType} tone="blue" />
              </div>
              <div className="space-y-2">
                <Input
                  value={l.draftSubject ?? ""}
                  onChange={(e) => updateLead(l.id, { draftSubject: e.target.value })}
                  placeholder="Subject"
                />
                <Textarea
                  rows={8}
                  value={l.draftBody ?? ""}
                  onChange={(e) => updateLead(l.id, { draftBody: e.target.value })}
                />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-brand-turquoise/40 text-brand-turquoise hover:bg-brand-turquoise/10"
                  onClick={() => {
                    const d = generateDraft(l);
                    updateLead(l.id, { draftSubject: d.subject, draftBody: d.body });
                    toast.success("Draft regenerated");
                  }}
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Regenerate draft
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => updateLead(l.id, { status: "Skipped" })}
                >
                  Skip
                </Button>
                <Button size="sm" onClick={() => pushLead(l.id)}>
                  Approve and push to Lemlist
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
