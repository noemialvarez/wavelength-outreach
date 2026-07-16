import { useState } from "react";
import { Loader2, Bell } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import api from "@/lib/api";

type NoReplyLead = {
  id: string;
  name: string;
  company: string;
  linkedin_url?: string;
  linkedin_message_sent_at?: string;
};

export function LinkedinReminders() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());

  const { data: leads = [], isLoading } = useQuery<NoReplyLead[]>({
    queryKey: ["leads", "linkedin-no-reply"],
    queryFn: () =>
      api
        .get("/api/leads", {
          params: { linkedin_message_status: "sent", no_reply_days: 3, limit: 100 },
        })
        .then((r) => (r.data.data ?? r.data ?? []) as NoReplyLead[]),
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

  const sendReminders = async (ids: string[]) => {
    if (ids.length === 0 || sendingIds.size > 0) return;
    setSendingIds(new Set(ids));
    let sent = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        await api.post(`/api/leads/${id}/linkedin-reminder/draft`);
        await api.post(`/api/leads/${id}/linkedin-reminder/approve`);
        sent++;
      } catch {
        failed++;
      }
      setSendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
    queryClient.invalidateQueries({ queryKey: ["leads", "linkedin-no-reply"] });
    setSelected(new Set());
    toast.success(
      `${sent} reminder${sent === 1 ? "" : "s"} sent${failed ? `, ${failed} failed` : ""}`,
    );
  };

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">No reply after 3 days</h2>
          <p className="text-xs text-muted-foreground">
            LinkedIn messages sent 3+ days ago with no reply — send a reminder.
          </p>
        </div>
        {leads.length > 0 && (
          <span className="text-xs text-muted-foreground">{leads.length} pending</span>
        )}
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
      ) : leads.length === 0 ? (
        <EmptyState icon={Bell} message="No leads waiting on a reminder." />
      ) : (
        <div className="space-y-3">
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
              className="ml-auto"
              disabled={selected.size === 0 || sendingIds.size > 0}
              onClick={() => sendReminders(Array.from(selected))}
            >
              {sendingIds.size > 0 ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Sending… ({sendingIds.size} left)
                </>
              ) : (
                "Send reminder"
              )}
            </Button>
          </div>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Message sent</TableHead>
                  <TableHead>LinkedIn</TableHead>
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
                    <TableCell className="text-sm text-muted-foreground">{l.company}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {l.linkedin_message_sent_at?.slice(0, 10) ?? "—"}
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
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-brand-turquoise/40 text-brand-turquoise hover:bg-brand-turquoise/10"
                        disabled={sendingIds.size > 0}
                        onClick={() => sendReminders([l.id])}
                      >
                        {sendingIds.has(l.id) ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Send reminder"
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </Card>
  );
}
