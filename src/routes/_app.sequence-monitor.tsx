import { createFileRoute } from "@tanstack/react-router";
import { Activity, Flag, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";
import api from "@/lib/api";

export const Route = createFileRoute("/_app/sequence-monitor")({
  head: () => ({ meta: [{ title: "Campaign Monitor — Wavelength" }] }),
  component: SequenceMonitorPage,
});

type SeqLead = {
  id: string;
  email?: string;
  status?: string;
  step?: string;
  last_event_at?: string;
  leads?: { name?: string; company?: string };
  sequences?: { name?: string };
};

const STATUS_TONE: Record<string, "turquoise" | "pink" | "blue" | "muted"> = {
  Active: "blue",
  Opened: "pink",
  Replied: "turquoise",
  Bounced: "muted",
  Unsubscribed: "muted",
  ongoing: "blue",
  paused: "muted",
  finished: "turquoise",
};

function fmt(dateStr?: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-CH", { day: "numeric", month: "short" });
}

function SequenceMonitorPage() {
  const queryClient = useQueryClient();
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data: seqLeads = [], isLoading } = useQuery<SeqLead[]>({
    queryKey: ["sequence-leads"],
    queryFn: () => api.get("/api/sequences/leads").then((r) => r.data),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post("/api/sequences/sync"),
    onSuccess: (r) => {
      toast.success(`Synced ${r.data.synced_sequences} campaigns, ${r.data.synced_leads} leads`);
      queryClient.invalidateQueries({ queryKey: ["sequence-leads"] });
    },
    onError: () => toast.error("Sync failed — check Lemlist API key"),
  });

  const main = seqLeads.filter((r) => !flagged.has(r.id));
  const flaggedRows = seqLeads.filter((r) => flagged.has(r.id));

  const active = seqLeads.filter((r) => r.status === "Active" || r.status === "ongoing").length;
  const openedNoReply = seqLeads.filter((r) => r.status === "Opened").length;
  const replied = seqLeads.filter((r) => r.status === "Replied" || r.status === "finished").length;
  const bounced = seqLeads.filter((r) => r.status === "Bounced").length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Campaign Monitor</h1>
          <p className="text-sm text-muted-foreground">
            Track how your outreach is performing and rescue warm opens.
          </p>
        </div>
        <Button variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
          <RefreshCw className={cn("mr-1.5 h-4 w-4", syncMutation.isPending && "animate-spin")} />
          {syncMutation.isPending ? "Syncing…" : "Sync from Lemlist"}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Active in campaign", value: active, tone: "text-brand-blue" },
          { label: "Opened, no reply", value: openedNoReply, tone: "text-primary" },
          { label: "Replied", value: replied, tone: "text-brand-turquoise" },
          { label: "Bounced", value: bounced, tone: "text-muted-foreground" },
        ].map((c) => (
          <Card key={c.label} className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <p className={cn("mt-2 text-3xl font-semibold", c.tone)}>{c.value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold">Active campaigns</h2>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : main.length === 0 ? (
          <EmptyState
            icon={Activity}
            message="No active campaigns. Push leads from Email Outreach or sync from Lemlist."
          />
        ) : (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Step</TableHead>
                  <TableHead>Last activity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {main.map((row) => {
                  const opened = row.status === "Opened";
                  return (
                    <TableRow key={row.id} className={cn(opened && "bg-primary/5")}>
                      <TableCell className="font-medium">{row.leads?.name ?? row.email}</TableCell>
                      <TableCell>{row.leads?.company ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.sequences?.name}</TableCell>
                      <TableCell>{row.step ? `Step ${row.step}` : "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmt(row.last_event_at)}</TableCell>
                      <TableCell>
                        {row.status && (
                          <StatusBadge
                            label={row.status}
                            tone={STATUS_TONE[row.status] ?? "muted"}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {opened && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setFlagged((prev) => new Set([...prev, row.id]));
                              toast.success("Flagged for manual follow-up");
                            }}
                          >
                            <Flag className="mr-1.5 h-3.5 w-3.5" /> Flag
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {flaggedRows.length > 0 && (
        <Card className="p-6">
          <h2 className="mb-4 text-base font-semibold">Flagged for follow-up</h2>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flaggedRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.leads?.name ?? row.email}</TableCell>
                    <TableCell>{row.leads?.company ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.sequences?.name}</TableCell>
                    <TableCell>
                      {row.status && (
                        <StatusBadge label={row.status} tone={STATUS_TONE[row.status] ?? "muted"} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Add note..."
                        value={notes[row.id] ?? ""}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
