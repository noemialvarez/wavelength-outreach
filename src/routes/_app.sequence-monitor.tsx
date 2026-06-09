import { createFileRoute } from "@tanstack/react-router";
import { Activity, Flag } from "lucide-react";
import { toast } from "sonner";
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
import { store, useStore, type SequenceStatus } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/sequence-monitor")({
  head: () => ({ meta: [{ title: "Sequence Monitor — InsightSphere" }] }),
  component: SequenceMonitorPage,
});

const statusTones: Record<SequenceStatus, "turquoise" | "pink" | "blue" | "muted" | "amber"> = {
  Active: "blue",
  Opened: "pink",
  Replied: "turquoise",
  Bounced: "muted",
  Unsubscribed: "muted",
};

function SequenceMonitorPage() {
  const sequences = useStore((s) => s.sequences);

  const active = sequences.filter((s) => s.status === "Active").length;
  const openedNoReply = sequences.filter((s) => s.status === "Opened").length;
  const replied = sequences.filter((s) => s.status === "Replied").length;
  const bounced = sequences.filter((s) => s.status === "Bounced").length;

  const main = sequences.filter((s) => !s.flagged);
  const flagged = sequences.filter((s) => s.flagged);

  const flag = (id: string) => {
    store.set((s) => ({
      ...s,
      sequences: s.sequences.map((x) => (x.id === id ? { ...x, flagged: true, notes: "" } : x)),
    }));
    toast.success("Flagged for manual follow-up");
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Sequence Monitor</h1>
        <p className="text-sm text-muted-foreground">
          Track how your outreach is performing and rescue warm opens.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Active in sequence", value: active, tone: "text-brand-blue" },
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
        <h2 className="mb-4 text-base font-semibold">Active sequences</h2>
        {main.length === 0 ? (
          <EmptyState
            icon={Activity}
            message="No active sequences. Push leads from Email Outreach to get started."
          />
        ) : (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Company</TableHead>
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
                      <TableCell className="font-medium">{row.leadName}</TableCell>
                      <TableCell>{row.company}</TableCell>
                      <TableCell>Step {row.step}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.lastActivity}
                      </TableCell>
                      <TableCell>
                        <StatusBadge label={row.status} tone={statusTones[row.status]} />
                      </TableCell>
                      <TableCell className="text-right">
                        {opened && (
                          <Button size="sm" variant="outline" onClick={() => flag(row.id)}>
                            <Flag className="mr-1.5 h-3.5 w-3.5" /> Flag for manual follow-up
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

      {flagged.length > 0 && (
        <Card className="p-6">
          <h2 className="mb-4 text-base font-semibold">Flagged for follow-up</h2>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Step</TableHead>
                  <TableHead>Last activity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flagged.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.leadName}</TableCell>
                    <TableCell>{row.company}</TableCell>
                    <TableCell>Step {row.step}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.lastActivity}
                    </TableCell>
                    <TableCell>
                      <StatusBadge label={row.status} tone={statusTones[row.status]} />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Add note..."
                        value={row.notes ?? ""}
                        onChange={(e) =>
                          store.set((s) => ({
                            ...s,
                            sequences: s.sequences.map((x) =>
                              x.id === row.id ? { ...x, notes: e.target.value } : x,
                            ),
                          }))
                        }
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
