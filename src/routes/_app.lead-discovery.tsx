import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Radar, Search, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { EmptyState } from "@/components/empty-state";
import { store, useStore } from "@/lib/store";
import api from "@/lib/api";
import { ByNameSearch } from "@/components/lead-discovery/by-name-search";
import { CollapsibleSection } from "@/components/lead-discovery/collapsible-section";
import { LeadGroup, useLeadActions, type LeadRow } from "@/components/lead-discovery/lead-group";

export const Route = createFileRoute("/_app/lead-discovery")({
  head: () => ({ meta: [{ title: "Lead Discovery — Wavelength" }] }),
  component: LeadDiscoveryPage,
});

type DescriptionMatch = {
  id?: string;
  name?: string;
  company?: string;
  company_name?: string;
  website?: string;
  url?: string;
  industry?: string;
  geography?: string;
  description?: string;
  why_match?: string;
  whyMatches?: string;
  why_it_matches?: string;
};

function LeadDiscoveryPage() {
  const icp = useStore((s) => s.icp);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [descQuery, setDescQuery] = useState({
    description: "",
    industries: [] as string[],
    geography: "",
    jobTitles: "",
    audience: "B2B" as "B2B" | "B2C",
    sizes: [] as string[],
  });
  const [descResults, setDescResults] = useState<DescriptionMatch[]>([]);
  const [approvedMatches, setApprovedMatches] = useState<Set<string>>(new Set());
  const [icpResults, setIcpResults] = useState<DescriptionMatch[]>([]);
  const [approvedIcpMatches, setApprovedIcpMatches] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();
  const leadActions = useLeadActions();

  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: () => api.get("/api/leads", { params: { limit: 200 } }).then((r) => r.data.data ?? []),
  });
  const leads = leadsData ?? [];
  const pageLeadCount = (leads as LeadRow[]).filter(
    (l) => l.source === "icp_filters" || l.source === "company_description",
  ).length;

  const descSearchMutation = useMutation({
    mutationFn: () =>
      api
        .post("/api/discovery/by-description", {
          description: descQuery.description,
          industries: descQuery.industries,
          geography: descQuery.geography,
          jobTitles: descQuery.jobTitles
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          audience: descQuery.audience,
          companySizes: descQuery.sizes,
        })
        .then((r) => {
          const d = r.data;
          const raw: Array<Record<string, string>> = Array.isArray(d)
            ? d
            : (d?.data ?? d?.results ?? []);
          return raw.map((item) => ({
            ...item,
            // Claude returns company_name; normalise to company for consistent use
            company: item.company || item.company_name || "",
            whyMatches: item.whyMatches || item.why_match || item.why_it_matches || "",
          })) as DescriptionMatch[];
        }),
    onSuccess: (data) => {
      setDescResults(data);
      setApprovedMatches(new Set());
      if (!data.length) toast.info("No matching companies found");
      else toast.success(`${data.length} matching companies found`);
    },
    onError: () => toast.error("Description search failed — check backend connection"),
  });

  const approveMatchMutation = useMutation({
    mutationFn: (m: DescriptionMatch) => {
      console.log("[approveMatch] match object:", m);
      // Use Option 2's own jobTitles field; fall back to Option 1's ICP titles
      // so founder search can rank by seniority.
      const titles = descQuery.jobTitles
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const payload = {
        name: m.company_name || m.company || m.name || "",
        company: m.company_name || m.company || m.name || "",
        website: m.website || m.url || "",
        notes: m.description || m.why_match || m.whyMatches || m.why_it_matches || "",
        source: "company_description",
        status: "Approved",
        titles: titles.length ? titles : icp.titles,
      };
      console.log("[approveMatch] payload:", payload);
      return api.post("/api/leads", payload);
    },
    onSuccess: (_d, m) => {
      const key = m.id ?? m.company_name ?? m.company ?? m.name ?? "";
      setApprovedMatches((prev) => new Set(prev).add(key));
      toast.success(`${m.company_name ?? m.company ?? m.name} added as lead`);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: () => toast.error("Failed to add lead"),
  });

  const normalizeMatch = (item: Record<string, string>): DescriptionMatch => ({
    ...item,
    company: item.company || item.company_name || "",
    whyMatches: item.whyMatches || item.why_match || item.why_it_matches || "",
  });

  const icpSearchMutation = useMutation({
    mutationFn: async () => {
      const r = await api.post("/api/discovery/by-icp", {
        companyNames: icp.companyNames,
        jobTitles: icp.titles,
        industries: icp.industries,
        companySizes: icp.companySizes,
        geography: icp.geography,
      });
      const d = r.data;
      const raw: Array<Record<string, string>> = Array.isArray(d)
        ? d
        : (d?.data ?? d?.results ?? []);
      return raw.map(normalizeMatch);
    },
    onMutate: () => {
      setApprovedIcpMatches(new Set());
    },
    onSuccess: (data) => {
      setIcpResults(data);
      setApprovedIcpMatches(new Set());
      if (!data.length) toast.info("No matching companies found");
      else toast.success(`${data.length} matching companies found`);
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const serverMsg = (err as { response?: { data?: { error?: string } } })?.response?.data
        ?.error;
      const msg =
        serverMsg ??
        (status === 402
          ? "ICP search failed — enrichment credits exhausted (402 Payment Required)"
          : status === 404
            ? "ICP search failed — backend endpoint not found (404)"
            : "ICP search failed — check backend connection");
      toast.error(msg);
    },
  });

  const approveIcpMutation = useMutation({
    mutationFn: (m: DescriptionMatch) => {
      const payload = {
        name: m.company_name || m.company || m.name || "",
        company: m.company_name || m.company || m.name || "",
        website: m.website || m.url || "",
        notes: m.description || m.whyMatches || "",
        source: "icp_filters",
        status: "Approved",
        // Backend ranks these by seniority and stops at the first hit.
        titles: icp.titles,
      };
      return api.post("/api/leads", payload);
    },
    onSuccess: (_d, m) => {
      const key = m.id ?? m.company_name ?? m.company ?? m.name ?? "";
      setApprovedIcpMatches((prev) => new Set(prev).add(key));
      toast.success(`${m.company_name ?? m.company ?? m.name} added as lead`);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: () => toast.error("Failed to add lead"),
  });

  // Only ICP / company-description leads are listed here. News-source leads live on
  // the "By news sources" page; by_name leads are listed inside Option 3.
  const filtered = useMemo(
    () =>
      (leads as LeadRow[]).filter(
        (l) =>
          (l.source === "icp_filters" || l.source === "company_description") &&
          (statusFilter === "all" || l.status === statusFilter),
      ),
    [leads, statusFilter],
  );
  const sections = [
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
  ].filter((sec) => sec.items.length > 0);

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
        <h1 className="text-2xl font-semibold">Lead Discovery</h1>
        <p className="text-sm text-muted-foreground">
          Discover potential leads based on 3 options: (1) ICP filters, (2) company description and
          (3) by name. To find leads from news signals, use{" "}
          <Link to="/lead-discovery/news-sources" className="text-brand-blue hover:underline">
            by news sources
          </Link>
          .
        </p>
      </div>

      {/* Option 1 — ICP filters */}
      <CollapsibleSection
        eyebrow="Option 1"
        title="By ICP filters"
        description="All filters are optional. Used to enrich leads through Sales Navigator. Saved automatically."
        primaryAction={
          <Button
            size="sm"
            disabled={icpSearchMutation.isPending}
            onClick={() => icpSearchMutation.mutate()}
          >
            {icpSearchMutation.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-1.5 h-4 w-4" />
            )}
            {icpSearchMutation.isPending ? "Searching…" : "Find matching ICP"}
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium">
              Company names <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              value={icp.companyNames.join(", ")}
              onChange={(e) =>
                store.set((s) => ({
                  ...s,
                  icp: {
                    ...s.icp,
                    companyNames: e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  },
                }))
              }
              placeholder="e.g. Nordlys AI, Helvetia Robotics"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">
              Target job titles <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              value={icp.titles.join(", ")}
              onChange={(e) =>
                store.set((s) => ({
                  ...s,
                  icp: {
                    ...s.icp,
                    titles: e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  },
                }))
              }
              placeholder="CEO, Head of Sales"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">
              Industries <span className="text-muted-foreground">(optional)</span>
            </label>
            <MultiSelect
              options={[
                { value: "SaaS", label: "SaaS" },
                { value: "Fintech", label: "Fintech" },
                { value: "Healthtech", label: "Healthtech" },
                { value: "E-commerce", label: "E-commerce" },
                { value: "Manufacturing", label: "Manufacturing" },
                { value: "Logistics", label: "Logistics" },
                { value: "Media", label: "Media" },
                { value: "Education", label: "Education" },
                { value: "Energy", label: "Energy" },
              ]}
              value={icp.industries}
              onChange={(v) => store.set((s) => ({ ...s, icp: { ...s.icp, industries: v } }))}
              placeholder="Select industries"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">
              Company size <span className="text-muted-foreground">(optional)</span>
            </label>
            <MultiSelect
              options={[
                { value: "1-10", label: "1-10" },
                { value: "11-50", label: "11-50" },
                { value: "51-200", label: "51-200" },
                { value: "201-500", label: "201-500" },
                { value: "501-1000", label: "501-1000" },
                { value: "1001-5000", label: "1001-5000" },
                { value: ">5000", label: ">5000" },
              ]}
              value={icp.companySizes}
              onChange={(v) => store.set((s) => ({ ...s, icp: { ...s.icp, companySizes: v } }))}
              placeholder="Select sizes"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">
              Geography <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              value={icp.geography}
              onChange={(e) =>
                store.set((s) => ({ ...s, icp: { ...s.icp, geography: e.target.value } }))
              }
              placeholder="e.g. Switzerland, DACH, Europe"
            />
          </div>
        </div>
      </CollapsibleSection>

      {icpResults.length > 0 && (
        <Card className="space-y-3 p-6">
          <div className="text-xs font-medium text-muted-foreground">
            {icpResults.length} matching {icpResults.length === 1 ? "company" : "companies"}
          </div>
          {icpResults.map((m, i) => {
            const key = m.id ?? `${m.company_name ?? m.company ?? "unknown"}-${i}`;
            const site = m.website ?? m.url;
            const cardKey = m.id ?? m.company_name ?? m.company ?? "";
            const approved = approvedIcpMatches.has(cardKey);
            const isApprovingThis =
              approveIcpMutation.isPending &&
              (approveIcpMutation.variables?.id ??
                approveIcpMutation.variables?.company_name ??
                approveIcpMutation.variables?.company) === cardKey;
            return (
              <div key={key} className="rounded-md border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold">{m.company_name ?? m.company}</div>
                    {site && (
                      <a
                        href={site.startsWith("http") ? site : `https://${site}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-brand-blue hover:underline"
                      >
                        {site}
                      </a>
                    )}
                  </div>
                  <Button
                    size="sm"
                    disabled={approved || isApprovingThis}
                    onClick={() => approveIcpMutation.mutate(m)}
                    style={{ backgroundColor: "#E31B84", color: "white" }}
                    className="hover:opacity-90"
                  >
                    {isApprovingThis ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : approved ? (
                      "Approved"
                    ) : (
                      "Approve as lead"
                    )}
                  </Button>
                </div>
                {(m.industry || m.geography) && (
                  <div className="text-xs text-muted-foreground">
                    {[m.industry, m.geography].filter(Boolean).join(" · ")}
                  </div>
                )}
                {m.description && <p className="text-sm">{m.description}</p>}
                {m.whyMatches && (
                  <div className="rounded-md bg-muted/60 p-3 text-sm">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Why it matches
                    </div>
                    {m.whyMatches}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {/* Option 2 — By Company Description */}
      <CollapsibleSection
        eyebrow="Option 2"
        title="By company description"
        description={
          <>
            Describe the kind of company you want to find. We&apos;ll match against the broader web.
          </>
        }
        primaryAction={
          <Button
            size="sm"
            disabled={descSearchMutation.isPending}
            onClick={() => {
              if (!descQuery.description.trim()) {
                toast.error("Add a company description first");
                return;
              }
              descSearchMutation.mutate();
            }}
          >
            {descSearchMutation.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-1.5 h-4 w-4" />
            )}
            {descSearchMutation.isPending ? "Searching…" : "Find matching companies"}
          </Button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium">
              Describe the company you&apos;re looking for
            </label>
            <Textarea
              rows={4}
              value={descQuery.description}
              onChange={(e) => setDescQuery((q) => ({ ...q, description: e.target.value }))}
              placeholder="e.g. Mid-size European SaaS companies selling sales enablement tools to enterprise revenue teams, with a strong focus on AI-assisted workflows."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium">Industry</label>
              <MultiSelect
                options={[
                  { value: "SaaS", label: "SaaS" },
                  { value: "Fintech", label: "Fintech" },
                  { value: "Healthtech", label: "Healthtech" },
                  { value: "E-commerce", label: "E-commerce" },
                  { value: "Manufacturing", label: "Manufacturing" },
                  { value: "Logistics", label: "Logistics" },
                  { value: "Media", label: "Media" },
                  { value: "Education", label: "Education" },
                  { value: "Energy", label: "Energy" },
                ]}
                value={descQuery.industries}
                onChange={(v) => setDescQuery((q) => ({ ...q, industries: v }))}
                placeholder="Select industries"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Geography</label>
              <Input
                value={descQuery.geography}
                onChange={(e) => setDescQuery((q) => ({ ...q, geography: e.target.value }))}
                placeholder="e.g. Switzerland, DACH, Europe"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium">
                Target job titles <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                value={descQuery.jobTitles}
                onChange={(e) => setDescQuery((q) => ({ ...q, jobTitles: e.target.value }))}
                placeholder="e.g. CEO, Head of Sales, VP Marketing"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium">Audience</label>
              <RadioGroup
                value={descQuery.audience}
                onValueChange={(v) => setDescQuery((q) => ({ ...q, audience: v as "B2B" | "B2C" }))}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="B2B" id="aud-b2b" />
                  <Label htmlFor="aud-b2b" className="text-sm font-normal">
                    B2B
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="B2C" id="aud-b2c" />
                  <Label htmlFor="aud-b2c" className="text-sm font-normal">
                    B2C
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Company size</label>
              <MultiSelect
                options={[
                  { value: "1-10", label: "1-10" },
                  { value: "11-50", label: "11-50" },
                  { value: "51-200", label: "51-200" },
                  { value: "201-500", label: "201-500" },
                  { value: "501-1000", label: "501-1000" },
                  { value: "1001-5000", label: "1001-5000" },
                  { value: ">5000", label: ">5000" },
                ]}
                value={descQuery.sizes}
                onChange={(v) => setDescQuery((q) => ({ ...q, sizes: v }))}
                placeholder="Select sizes"
              />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {descResults.length > 0 && (
        <Card className="space-y-3 p-6">
          <div className="text-xs font-medium text-muted-foreground">
            {descResults.length} matching {descResults.length === 1 ? "company" : "companies"}
          </div>
          {descResults.map((m, i) => {
            const key = m.id ?? `${m.company_name ?? m.company ?? "unknown"}-${i}`;
            const why = m.whyMatches ?? m.why_it_matches;
            const site = m.website ?? m.url;
            const cardKey = m.id ?? m.company_name ?? m.company ?? "";
            const approved = approvedMatches.has(cardKey);
            const isApprovingThis =
              approveMatchMutation.isPending &&
              (approveMatchMutation.variables?.id ??
                approveMatchMutation.variables?.company_name ??
                approveMatchMutation.variables?.company) === cardKey;
            return (
              <div key={key} className="rounded-md border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold">{m.company_name ?? m.company}</div>
                    {site && (
                      <a
                        href={site.startsWith("http") ? site : `https://${site}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-brand-blue hover:underline"
                      >
                        {site}
                      </a>
                    )}
                  </div>
                  <Button
                    size="sm"
                    disabled={approved || isApprovingThis}
                    onClick={() => approveMatchMutation.mutate(m)}
                    style={{ backgroundColor: "#E31B84", color: "white" }}
                    className="hover:opacity-90"
                  >
                    {isApprovingThis ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : approved ? (
                      "Approved"
                    ) : (
                      "Approve as lead"
                    )}
                  </Button>
                </div>
                {(m.industry || m.geography) && (
                  <div className="text-xs text-muted-foreground">
                    {[m.industry, m.geography].filter(Boolean).join(" · ")}
                  </div>
                )}
                {m.description && <p className="text-sm">{m.description}</p>}
                {why && (
                  <div className="rounded-md bg-muted/60 p-3 text-sm">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Why it matches
                    </div>
                    {why}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {/* Option 3 — By name */}
      <ByNameSearch />

      {/* Leads table */}
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
        ) : filtered.length === 0 ? (
          <EmptyState icon={Radar} message="No leads yet. Run a search above to find leads." />
        ) : (
          <div className="space-y-6">
            {sections.map((sec) => (
              <LeadGroup
                key={sec.title}
                eyebrow={sec.eyebrow}
                title={sec.title}
                items={sec.items}
                actions={leadActions}
                collapsed={collapsedSections.has(sec.title)}
                onToggleCollapsed={() => toggleSection(sec.title)}
              />
            ))}
          </div>
        )}
      </CollapsibleSection>

      <div className="flex justify-end pt-2">
        <Link
          to="/linkedin-engagement"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-pink hover:underline"
        >
          Next step <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
