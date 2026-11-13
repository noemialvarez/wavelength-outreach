import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";
import { NameSearchLeads, useNameSearchLeads } from "@/components/lead-discovery/name-search-leads";
import { NameEmailLeads, useNameEmailLeads } from "@/components/lead-discovery/name-email-leads";
import { RevealableList } from "@/components/lead-discovery/group-parts";
import { LinkedinFollowUp } from "@/components/lead-discovery/linkedin-follow-up";
import { CollapsibleSection } from "@/components/lead-discovery/collapsible-section";
import { LeadGroup, useLeadActions, type LeadRow } from "@/components/lead-discovery/lead-group";

export const Route = createFileRoute("/_app/lead-discovery_/results")({
  head: () => ({ meta: [{ title: "Leads Results — Wavelength" }] }),
  component: LeadResultsPage,
});

function LeadResultsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const leadActions = useLeadActions();

  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: () => api.get("/api/leads", { params: { limit: 200 } }).then((r) => r.data.data ?? []),
  });
  const leads = useMemo(() => leadsData ?? [], [leadsData]);
  const pageLeadCount = (leads as LeadRow[]).filter(
    (l) => l.source === "icp_filters" || l.source === "company_description",
  ).length;

  // Only ICP / company-description leads are listed in the Option 1/2 groups. News-source leads
  // live on the "By news sources" page; by-name leads have their own lists (Option 3a / 3b).
  const filtered = useMemo(
    () =>
      (leads as LeadRow[]).filter(
        (l) =>
          (l.source === "icp_filters" || l.source === "company_description") &&
          (statusFilter === "all" || l.status === statusFilter),
      ),
    [leads, statusFilter],
  );
  const { data: nameLeads = [] } = useNameSearchLeads();
  const { data: nameEmailLeads = [] } = useNameEmailLeads();
  const hasApproved = [...(leads as LeadRow[]), ...nameLeads, ...nameEmailLeads].some(
    (l) => l.status === "Approved",
  );
  const allSections = [
    {
      eyebrow: "Option 1",
      title: "Leads from ICP filters",
      items: filtered.filter((l) => l.source === "icp_filters"),
    },
    {
      eyebrow: "Option 2",
      title: "Leads from company description",
      items: filtered.filter((l) => l.source === "company_description"),
    },
  ];

  const toggleSection = (title: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };
  const expandAllSections = () => setCollapsedSections(new Set());

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Lead Discovery · Leads Results</h1>
        <p className="text-sm text-muted-foreground">
          Every lead found in Lead Discovery. Each list shows its first lead — use "Show all" to
          open the full list.
        </p>
      </div>

      <CollapsibleSection
        title="Leads Results"
        badge={
          <span className="text-xs font-normal text-muted-foreground">
            {filtered.length} of {pageLeadCount} leads
          </span>
        }
        headerExtra={
          <div className="flex items-center gap-2">
            {collapsedSections.size > 0 && (
              <button
                type="button"
                onClick={expandAllSections}
                className="text-sm font-medium text-brand-blue hover:underline"
              >
                Expand all lists
              </button>
            )}
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
          </div>
        }
      >
        {leadsLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading leads…</p>
        ) : (
          <div className="space-y-6">
            {allSections.map((sec) => (
              <RevealableList
                key={sec.title}
                eyebrow={sec.eyebrow}
                title={sec.title}
                count={sec.items.length}
              >
                <LeadGroup
                  eyebrow={sec.eyebrow}
                  title={sec.title}
                  items={sec.items}
                  actions={leadActions}
                  collapsed={collapsedSections.has(sec.title)}
                  onToggleCollapsed={() => toggleSection(sec.title)}
                />
              </RevealableList>
            ))}
            <RevealableList
              eyebrow="Option 3A"
              title="Leads from name search (LinkedIn)"
              count={nameLeads.length}
            >
              <NameSearchLeads />
            </RevealableList>
            <RevealableList
              eyebrow="Option 3B"
              title="Leads from name search (email)"
              count={nameEmailLeads.length}
            >
              <NameEmailLeads />
            </RevealableList>
          </div>
        )}
      </CollapsibleSection>

      <LinkedinFollowUp />

      {hasApproved && (
        <div className="flex justify-end pt-2">
          <Link
            to="/email-outreach"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-pink hover:underline"
          >
            Next step: write draft <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
