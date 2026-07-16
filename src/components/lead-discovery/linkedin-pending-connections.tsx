import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { UserX } from "lucide-react";
import api from "@/lib/api";

type PendingConnection = {
  id: string;
  name: string;
  company: string;
  linkedin_url?: string;
  linkedin_connection_requested_at?: string;
};

// Plain content block — its title/description/badge live on the
// CollapsibleSection wrapper that renders it (under Leads Results).
export function LinkedinPendingConnections() {
  const { data: leads = [], isLoading } = useQuery<PendingConnection[]>({
    queryKey: ["leads", "linkedin-pending"],
    queryFn: () =>
      api
        .get("/api/leads", { params: { linkedin_connection_status: "requested", limit: 100 } })
        .then((r) => (r.data.data ?? r.data ?? []) as PendingConnection[]),
  });

  return (
    <div className="space-y-3">
      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : leads.length === 0 ? (
        <EmptyState icon={UserX} message="No pending connection requests." />
      ) : (
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>LinkedIn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.company}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {l.linkedin_connection_requested_at?.slice(0, 10) ?? "—"}
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
