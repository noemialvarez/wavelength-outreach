import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Radar, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import api from "@/lib/api";
import { ShowLeadsCta } from "@/components/lead-discovery/group-parts";
import { CollapsibleSection } from "@/components/lead-discovery/collapsible-section";
import { LeadGroup, useLeadActions, type LeadRow } from "@/components/lead-discovery/lead-group";

export const Route = createFileRoute("/_app/lead-discovery_/news-results")({
  head: () => ({ meta: [{ title: "News source results — Wavelength" }] }),
  component: NewsResultsPage,
});

function NewsResultsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [leadsCollapsed, setLeadsCollapsed] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const leadActions = useLeadActions();

  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: () => api.get("/api/leads", { params: { limit: 200 } }).then((r) => r.data.data ?? []),
  });
  // Leads that came from a signal scan: everything except ICP, company-description and
  // by-name leads, which are listed on the Leads Results page.
  const signalLeads = useMemo(
    () =>
      ((leadsData ?? []) as LeadRow[]).filter(
        (l) =>
          l.source !== "icp_filters" &&
          l.source !== "company_description" &&
          l.source !== "by_name" &&
          l.source !== "by_name_email",
      ),
    [leadsData],
  );
  const filteredLeads = signalLeads.filter(
    (l) =>
      (statusFilter === "all" || l.status === statusFilter) &&
      (typeFilter === "all" || l.signalType === typeFilter),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Lead Discovery · News source results</h1>
        <p className="text-sm text-muted-foreground">
          Leads that came from approved news signals. Each list shows its first leads — use "Show
          all" to open the full list.
        </p>
      </div>

      <CollapsibleSection
        title="Leads Results"
        defaultOpen
        badge={
          <span className="text-xs font-normal text-muted-foreground">
            {filteredLeads.length} of {signalLeads.length} leads
          </span>
        }
        headerExtra={
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Pending review">Pending review</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Skipped">Skipped</SelectItem>
                <SelectItem value="Pushed">Pushed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Signal type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All signals</SelectItem>
                <SelectItem value="Funding">Funding</SelectItem>
                <SelectItem value="Key hire">Key hire</SelectItem>
                <SelectItem value="Product launch">Product launch</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        {leadsLoading ? (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading leads…
          </p>
        ) : !revealed ? (
          <ShowLeadsCta count={signalLeads.length} onClick={() => setRevealed(true)} />
        ) : filteredLeads.length === 0 ? (
          <EmptyState icon={Radar} message="No leads yet. Configure your sources and run a scan." />
        ) : (
          <LeadGroup
            title="Leads by News Sources"
            items={filteredLeads}
            actions={leadActions}
            collapsed={leadsCollapsed}
            onToggleCollapsed={() => setLeadsCollapsed((v) => !v)}
          />
        )}
      </CollapsibleSection>
    </div>
  );
}
