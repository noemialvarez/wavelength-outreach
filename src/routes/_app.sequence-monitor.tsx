import { createFileRoute } from "@tanstack/react-router";
import { Activity, RefreshCw } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  head: () => ({ meta: [{ title: "Sequence Monitor — Wavelength" }] }),
  component: SequenceMonitorPage,
});

type LeadStatus = {
  id: string;
  name: string;
  company: string;
  email: string;
  status: "sent" | "opened" | "clicked" | "replied" | "bounced";
  last_updated: string | null;
};

type Tone = "blue" | "amber" | "turquoise" | "purple" | "red" | "muted";

const STATUS_TONE: Record<string, Tone> = {
  sent: "blue",
  opened: "amber",
  clicked: "turquoise",
  replied: "purple",
  bounced: "red",
};

function fmt(dateStr?: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-CH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function SequenceMonitorPage() {
  const queryClient = useQueryClient();

  const { data: leads = [], isLoading, isFetching } = useQuery<LeadStatus[]>({
    queryKey: ["sequence-status"],
    queryFn: () => api.get("/api/sequences/status").then((r) => r.data),
  });

  const counts = {
    sent: leads.filter((l) => l.status === "sent").length,
    opened: leads.filter((l) => l.status === "opened").length,
    clicked: leads.filter((l) => l.status === "clicked").length,
    replied: leads.filter((l) => l.status === "replied").length,
    bounced: leads.filter((l) => l.status === "bounced").length,
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sequence Monitor</h1>
          <p className="text-sm text-muted-foreground">
            Live status of all leads pushed to Lemlist.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["sequence-status"] })}
          disabled={isFetching}
        >
          <RefreshCw className={cn("mr-1.5 h-4 w-4", isFetching && "animate-spin")} />
          {isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {[
          { label: "Sent", value: counts.sent, tone: "text-brand-blue" },
          { label: "Opened", value: counts.opened, tone: "text-amber-600" },
          { label: "Clicked", value: counts.clicked, tone: "text-brand-turquoise" },
          { label: "Replied", value: counts.replied, tone: "text-purple-600" },
          { label: "Bounced", value: counts.bounced, tone: "text-destructive" },
        ].map((c) => (
          <Card key={c.label} className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <p className={cn("mt-2 text-3xl font-semibold", c.tone)}>{c.value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold">All leads</h2>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : leads.length === 0 ? (
          <EmptyState
            icon={Activity}
            message="No leads found. Push leads from Email Outreach to get started."
          />
        ) : (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name || "—"}</TableCell>
                    <TableCell>{row.company || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.email}</TableCell>
                    <TableCell>
                      <StatusBadge
                        label={row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                        tone={STATUS_TONE[row.status] ?? "muted"}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmt(row.last_updated)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
