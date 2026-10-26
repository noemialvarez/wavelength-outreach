import { Loader2, RefreshCw, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { StatusBadge } from "@/components/status-badge";
import { errorMessage, type Contact } from "@/lib/contacts";
import api from "@/lib/api";

// Everyone a LinkedIn connection request was sent to, with whether they've accepted. LinkedIn
// doesn't notify the app, so "Refresh status" compares against your connections list.
export function ConnectionRequests() {
  const queryClient = useQueryClient();

  const { data: requests = [] } = useQuery({
    queryKey: ["contacts", "requested"],
    queryFn: () =>
      api
        .get("/api/contacts", { params: { requested: true } })
        .then((r) => ((r.data.data ?? []) as Contact[]).filter((c) => c.kind === "person")),
  });

  const refreshMutation = useMutation({
    mutationFn: () =>
      api
        .post("/api/contacts/check-connections", {
          refresh: true,
          lead_ids: [...new Set(requests.map((c) => c.lead_id))],
        })
        .then((r) => r.data as { checked: number; connections_available: boolean }),
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      if (d.connections_available) toast.success("Connection status refreshed");
      else toast.info("Couldn't verify connections — the Connections Export agent isn't available");
    },
    onError: (err: unknown) => toast.error(errorMessage(err, "Connection check failed")),
  });

  if (requests.length === 0) return null;

  const accepted = requests.filter((c) => c.connection === "yes").length;

  return (
    <Card className="p-6">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <UserPlus className="h-4 w-4 text-muted-foreground" /> Connection requests
          </h2>
          <p className="text-xs text-muted-foreground">
            {accepted} of {requests.length} accepted. LinkedIn doesn&apos;t tell this app when
            someone accepts, so use “Refresh status” to check.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={refreshMutation.isPending}
          onClick={() => refreshMutation.mutate()}
        >
          {refreshMutation.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-4 w-4" />
          )}
          {refreshMutation.isPending ? "Checking…" : "Refresh status"}
        </Button>
      </div>
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="w-32">Sent</TableHead>
              <TableHead className="w-40">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.role}</div>
                </TableCell>
                <TableCell className="text-sm">
                  {c.leads?.company || c.leads?.name || "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {c.requested_at ? c.requested_at.slice(0, 10) : "—"}
                </TableCell>
                <TableCell>
                  {c.connection === "yes" ? (
                    <StatusBadge label="Accepted" tone="turquoise" />
                  ) : c.request_status === "failed" ? (
                    <span title={c.request_error ?? ""}>
                      <StatusBadge label="Failed" tone="red" />
                    </span>
                  ) : (
                    <StatusBadge label="Pending" tone="amber" />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
