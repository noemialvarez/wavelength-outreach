import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Play, Radar, Trash2, Search, Loader2, Zap, UserSearch, Mail, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { store, useStore, uid, type SignalType, type LeadStatus } from "@/lib/store";
import api from "@/lib/api";

export const Route = createFileRoute("/_app/lead-discovery")({
  head: () => ({ meta: [{ title: "Lead Discovery — Wavelength" }] }),
  component: LeadDiscoveryPage,
});

const signalTones: Record<string, "turquoise" | "pink" | "blue" | "muted"> = {
  Funding: "turquoise",
  "Key hire": "blue",
  "Product launch": "pink",
  Other: "muted",
};
const statusTones: Record<LeadStatus, "turquoise" | "pink" | "blue" | "muted"> = {
  "Pending review": "muted",
  Approved: "turquoise",
  Skipped: "muted",
  Pushed: "blue",
};

type DiscoverySignal = {
  id: string;
  company_name: string | null;
  signal_url: string | null;
  source: string;
  status: string;
  created_at: string;
  raw_data: {
    signal_description?: string;
    signal_type?: string;
  } | null;
};

type DescriptionMatch = {
  id?: string;
  company: string;
  website?: string;
  url?: string;
  industry?: string;
  geography?: string;
  description?: string;
  whyMatches?: string;
  why_it_matches?: string;
};

function LeadDiscoveryPage() {
  const sources = useStore((s) => s.sources);
  const icp = useStore((s) => s.icp);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [localEmails, setLocalEmails] = useState<Record<string, string>>({});
  const [showAllSources, setShowAllSources] = useState(false);
  const [descQuery, setDescQuery] = useState({
    description: "",
    industries: [] as string[],
    geography: "",
    audience: "B2B" as "B2B" | "B2C",
    sizes: [] as string[],
  });
  const [descResults, setDescResults] = useState<DescriptionMatch[]>([]);
  const [approvedMatches, setApprovedMatches] = useState<Set<string>>(new Set());


  const queryClient = useQueryClient();

  const { data: signalsData, isLoading: signalsLoading } = useQuery({
    queryKey: ["signals"],
    queryFn: () =>
      api
        .get("/api/discovery/signals", { params: { status: "new", limit: 100 } })
        .then((r) => (r.data.data ?? []) as DiscoverySignal[]),
  });
  const newSignals = signalsData ?? [];

  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: () => api.get("/api/leads", { params: { limit: 200 } }).then((r) => r.data.data ?? []),
  });
  const leads = leadsData ?? [];

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/discovery/signals/${id}/promote`),
    onSuccess: () => {
      toast.success("Lead created from signal");
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: () => toast.error("Failed to approve signal"),
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/discovery/signals/${id}/dismiss`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signals"] });
    },
    onError: () => toast.error("Failed to dismiss signal"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/leads/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
    onError: () => toast.error("Failed to update lead status"),
  });

  const updateEmailMutation = useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) =>
      api.patch(`/api/leads/${id}`, { email }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
    onError: () => toast.error("Failed to save email"),
  });

  const findEmailMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/api/leads/${id}/find-email`).then((r) => r.data as { email: string | null }),
    onSuccess: (data, id) => {
      if (data.email) {
        setLocalEmails((prev) => ({ ...prev, [id]: data.email! }));
        toast.success(`Email found: ${data.email}`);
        queryClient.invalidateQueries({ queryKey: ["leads"] });
      } else {
        toast.info("No email found for this lead on Apollo");
      }
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Apollo lookup failed";
      toast.error(msg);
    },
  });

  const findFounderMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/api/leads/${id}/find-founder`).then((r) => r.data as { found: boolean; name?: string; linkedin_url?: string }),
    onSuccess: (data) => {
      if (data.found) {
        toast.success(`Founder found${data.name ? `: ${data.name}` : ""}`);
        queryClient.invalidateQueries({ queryKey: ["leads"] });
      } else {
        toast.info("No founder found on LinkedIn for this company");
      }
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Founder search failed";
      toast.error(msg);
    },
  });

  const scanMutation = useMutation({
    mutationFn: () => {
      const enabledSources = sources
        .filter((s) => s.enabled)
        .map((s) => s.name.toLowerCase().replace(/\s+/g, ""));
      return api.post("/api/discovery/scan", { sources: enabledSources });
    },
    onSuccess: () => {
      toast.success("Signal scan started — results will appear shortly");
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["leads"] });
        queryClient.invalidateQueries({ queryKey: ["signals"] });
      }, 8000);
    },
    onError: () => toast.error("Scan failed — check backend connection"),
  });

  const descSearchMutation = useMutation({
    mutationFn: () =>
      api
        .post("/api/discovery/by-description", {
          description: descQuery.description,
          industries: descQuery.industries,
          geography: descQuery.geography,
          audience: descQuery.audience,
          companySizes: descQuery.sizes,
        })
        .then((r) => {
          const d = r.data;
          const list: DescriptionMatch[] = Array.isArray(d) ? d : (d?.data ?? d?.results ?? []);
          return list;
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
    mutationFn: (m: DescriptionMatch) =>
      api.post("/api/leads", {
        company: m.company,
        signalSummary: m.whyMatches ?? m.why_it_matches ?? m.description ?? "Matched by company description",
        signalType: "Other",
        status: "Approved",
        website: m.website ?? m.url,
      }),
    onSuccess: (_d, m) => {
      const key = m.id ?? m.company;
      setApprovedMatches((prev) => new Set(prev).add(key));
      toast.success(`${m.company} added as lead`);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: () => toast.error("Failed to add lead"),
  });


  const filtered = useMemo(
    () =>
      leads.filter(
        (l: { status: string; signalType?: string }) =>
          (statusFilter === "all" || l.status === statusFilter) &&
          (typeFilter === "all" || l.signalType === typeFilter),
      ),
    [leads, statusFilter, typeFilter],
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setLeadStatus = (id: string, status: LeadStatus) => {
    updateStatusMutation.mutate({ id, status });
  };

  const bulkSet = (status: LeadStatus) => {
    selected.forEach((id) => updateStatusMutation.mutate({ id, status }));
    toast.success(`${selected.size} lead${selected.size === 1 ? "" : "s"} ${status.toLowerCase()}`);
    setSelected(new Set());
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Lead Discovery</h1>
        <p className="text-sm text-muted-foreground">
          Pull warm signals from your configured sources and shortlist the right founders.
        </p>
      </div>

      {/* Option 1 — ICP filters */}
      <Card className="p-6">
        <div className="mb-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-blue">
            Option 1
          </div>
          <h2 className="text-base font-semibold">By ICP filters</h2>
          <p className="text-xs text-muted-foreground">
            All filters are optional. Used to enrich leads through Sales Navigator. Saved automatically.
          </p>
        </div>
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
                    companyNames: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
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
                    titles: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
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
        <div className="flex justify-end pt-4">
          <Button
            size="sm"
            onClick={() => toast.success("ICP search queued — results will appear shortly")}
          >
            <Search className="mr-1.5 h-4 w-4" /> Find matching ICP
          </Button>
        </div>
      </Card>

      {/* Option 2 — By Company Description */}
      <Card className="p-6">
        <div className="mb-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-blue">
            Option 2
          </div>
          <h2 className="text-base font-semibold">By company description</h2>
          <p className="text-xs text-muted-foreground">
            Describe the kind of company you want to find. We&apos;ll match against the broader web.
          </p>
        </div>
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
            <div>
              <label className="mb-2 block text-xs font-medium">Audience</label>
              <RadioGroup
                value={descQuery.audience}
                onValueChange={(v) =>
                  setDescQuery((q) => ({ ...q, audience: v as "B2B" | "B2C" }))
                }
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="B2B" id="aud-b2b" />
                  <Label htmlFor="aud-b2b" className="text-sm font-normal">B2B</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="B2C" id="aud-b2c" />
                  <Label htmlFor="aud-b2c" className="text-sm font-normal">B2C</Label>
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
          <div className="flex justify-end">
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
          </div>

          {descResults.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="text-xs font-medium text-muted-foreground">
                {descResults.length} matching {descResults.length === 1 ? "company" : "companies"}
              </div>
              {descResults.map((m, i) => {
                const key = m.id ?? `${m.company}-${i}`;
                const why = m.whyMatches ?? m.why_it_matches;
                const site = m.website ?? m.url;
                const approved = approvedMatches.has(m.id ?? m.company);
                return (
                  <div key={key} className="rounded-md border bg-card p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold">{m.company}</div>
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
                        disabled={approved || approveMatchMutation.isPending}
                        onClick={() => approveMatchMutation.mutate(m)}
                        style={{ backgroundColor: "#E31B84", color: "white" }}
                        className="hover:opacity-90"
                      >
                        {approved ? "Approved" : "Approve as lead"}
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
            </div>
          )}
        </div>
      </Card>


      {/* Option 3 — Sources */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-blue">
              Option 3
            </div>
            <h2 className="text-base font-semibold">By sources</h2>
            <p className="text-xs text-muted-foreground">Toggle which feeds power your scan.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              store.set((s) => ({
                ...s,
                sources: [...s.sources, { id: uid(), name: "", url: "", enabled: true }],
              }))
            }
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add source
          </Button>
        </div>
        <div className="space-y-2">
          {(showAllSources ? sources : sources.slice(0, 3)).map((src) => (
            <div key={src.id} className="flex items-center gap-3 rounded-md border bg-muted/20 p-3">
              <Switch
                checked={src.enabled}
                onCheckedChange={(v) =>
                  store.set((s) => ({
                    ...s,
                    sources: s.sources.map((x) => (x.id === src.id ? { ...x, enabled: v } : x)),
                  }))
                }
              />
              <Input
                placeholder="Source name"
                value={src.name}
                onChange={(e) =>
                  store.set((s) => ({
                    ...s,
                    sources: s.sources.map((x) =>
                      x.id === src.id ? { ...x, name: e.target.value } : x,
                    ),
                  }))
                }
                className="max-w-xs"
              />
              <Input
                placeholder="https://..."
                value={src.url}
                onChange={(e) =>
                  store.set((s) => ({
                    ...s,
                    sources: s.sources.map((x) =>
                      x.id === src.id ? { ...x, url: e.target.value } : x,
                    ),
                  }))
                }
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  store.set((s) => ({ ...s, sources: s.sources.filter((x) => x.id !== src.id) }))
                }
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          {sources.length > 3 ? (
            <button
              type="button"
              onClick={() => setShowAllSources((v) => !v)}
              className="text-sm font-medium text-brand-blue hover:underline"
            >
              {showAllSources
                ? "Show fewer sources"
                : `Show all sources (${sources.length})`}
            </button>
          ) : <span />}
          <Button size="sm" onClick={() => scanMutation.mutate()} disabled={scanMutation.isPending}>
            <Play className="mr-1.5 h-4 w-4" />
            {scanMutation.isPending ? "Scanning..." : "Run signal scan"}
          </Button>
        </div>
      </Card>


      {/* Signals */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-brand-turquoise" />
            <h2 className="text-base font-semibold">Signals</h2>
            {newSignals.length > 0 && (
              <span className="rounded-full bg-brand-turquoise/15 px-2 py-0.5 text-xs font-medium text-brand-turquoise">
                {newSignals.length} new
              </span>
            )}
          </div>
        </div>

        {signalsLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading signals…</p>
        ) : newSignals.length === 0 ? (
          <EmptyState icon={Zap} message="No new signals. Run a scan to pull fresh results." />
        ) : (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Signal</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {newSignals.map((sig) => {
                  const signalType = sig.raw_data?.signal_type;
                  const signalDesc = sig.raw_data?.signal_description;
                  const isApproving = approveMutation.isPending && approveMutation.variables === sig.id;
                  const isDismissing = dismissMutation.isPending && dismissMutation.variables === sig.id;
                  return (
                    <TableRow key={sig.id}>
                      <TableCell className="font-medium">{sig.company_name ?? "—"}</TableCell>
                      <TableCell className="max-w-sm text-sm text-muted-foreground">
                        {sig.signal_url ? (
                          <a
                            href={sig.signal_url}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline"
                          >
                            {signalDesc ?? sig.signal_url}
                          </a>
                        ) : (
                          signalDesc ?? "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {signalType && (
                          <StatusBadge
                            label={signalType}
                            tone={signalTones[signalType] ?? "muted"}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{sig.source}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {sig.created_at?.slice(0, 10)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-brand-turquoise/40 text-brand-turquoise hover:bg-brand-turquoise/10"
                            onClick={() => approveMutation.mutate(sig.id)}
                            disabled={isApproving || isDismissing}
                          >
                            {isApproving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Approve"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => dismissMutation.mutate(sig.id)}
                            disabled={isApproving || isDismissing}
                          >
                            {isDismissing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Skip"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Leads table */}
      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Leads</h2>
            <p className="text-xs text-muted-foreground">
              {filtered.length} of {leads.length} leads
            </p>
          </div>
          <div className="flex gap-2">
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
        </div>

        {selected.size > 0 && (
          <div className="mb-3 flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <span className="text-sm">{selected.size} selected</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-brand-turquoise/40 text-brand-turquoise hover:bg-brand-turquoise/10"
                onClick={() => bulkSet("Approved")}
              >
                Approve selected
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulkSet("Skipped")}>
                Skip selected
              </Button>
            </div>
          </div>
        )}

        {leadsLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading leads…</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Radar} message="No leads yet. Configure your sources and run a scan." />
        ) : (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Signal</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Founder</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>LinkedIn</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l: {
                  id: string; company: string; notes?: string; signalType?: SignalType;
                  name: string; email?: string; linkedin_url?: string; status: LeadStatus; created_at: string;
                  enrichment_data?: { email_source?: string };
                }) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(l.id)}
                        onCheckedChange={() => toggleSelect(l.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{l.company}</TableCell>
                    <TableCell className="max-w-xs text-sm text-muted-foreground">
                      {l.notes}
                    </TableCell>
                    <TableCell>
                      {l.signalType && (
                        <StatusBadge label={l.signalType} tone={signalTones[l.signalType] ?? "muted"} />
                      )}
                    </TableCell>
                    <TableCell>{l.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Input
                          className="h-7 w-40 text-sm"
                          placeholder="founder@co.com"
                          value={localEmails[l.id] ?? l.email ?? ""}
                          onChange={(e) =>
                            setLocalEmails((prev) => ({ ...prev, [l.id]: e.target.value }))
                          }
                          onBlur={() => {
                            const val = localEmails[l.id];
                            if (val !== undefined && val !== (l.email ?? "")) {
                              updateEmailMutation.mutate({ id: l.id, email: val });
                            }
                          }}
                        />
                        {l.enrichment_data?.email_source === "apollo" && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Mail className="h-3.5 w-3.5 shrink-0 text-brand-blue" />
                              </TooltipTrigger>
                              <TooltipContent>Email found via Apollo</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                          title="Look up email via Apollo"
                          onClick={() => findEmailMutation.mutate(l.id)}
                          disabled={findEmailMutation.isPending && findEmailMutation.variables === l.id}
                        >
                          {findEmailMutation.isPending && findEmailMutation.variables === l.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Search className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
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
                    <TableCell>
                      <StatusBadge label={l.status} tone={statusTones[l.status as LeadStatus] ?? "muted"} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {l.created_at?.slice(0, 10)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          title="Find founder via LinkedIn"
                          onClick={() => findFounderMutation.mutate(l.id)}
                          disabled={findFounderMutation.isPending && findFounderMutation.variables === l.id}
                        >
                          {findFounderMutation.isPending && findFounderMutation.variables === l.id ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UserSearch className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Find founder
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-brand-turquoise/40 text-brand-turquoise hover:bg-brand-turquoise/10"
                          onClick={() => setLeadStatus(l.id, "Approved")}
                          disabled={l.status === "Approved" || l.status === "Pushed"}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setLeadStatus(l.id, "Skipped")}
                        >
                          Skip
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <div className="flex justify-end pt-2">
        <Link
          to="/email-outreach"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-pink hover:underline"
        >
          Next step <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>

  );
}
