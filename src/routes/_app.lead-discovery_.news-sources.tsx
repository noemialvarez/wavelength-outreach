import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Play, Trash2, Loader2, Zap, Radar } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { store, useStore, uid } from "@/lib/store";
import api from "@/lib/api";
import { CollapsibleSection } from "@/components/lead-discovery/collapsible-section";
import { LeadGroup, useLeadActions, type LeadRow } from "@/components/lead-discovery/lead-group";

export const Route = createFileRoute("/_app/lead-discovery_/news-sources")({
  head: () => ({ meta: [{ title: "Lead Discovery by News Sources — Wavelength" }] }),
  component: NewsSourcesPage,
});

const signalTones: Record<string, "turquoise" | "pink" | "blue" | "muted"> = {
  Funding: "turquoise",
  "Key hire": "blue",
  "Product launch": "pink",
  Other: "muted",
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

function NewsSourcesPage() {
  const sources = useStore((s) => s.sources);
  const icp = useStore((s) => s.icp);

  const [selectedSignals, setSelectedSignals] = useState<Set<string>>(new Set());
  const [showAllSources, setShowAllSources] = useState(false);
  const [showAllSignals, setShowAllSignals] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [leadsCollapsed, setLeadsCollapsed] = useState(false);

  const queryClient = useQueryClient();
  const leadActions = useLeadActions();

  const { data: signalsData, isLoading: signalsLoading } = useQuery({
    queryKey: ["signals"],
    queryFn: () =>
      api
        .get("/api/discovery/signals", { params: { status: "new", limit: 100 } })
        .then((r) => (r.data.data ?? []) as DiscoverySignal[]),
  });
  const newSignals = signalsData ?? [];
  const visibleSignals = showAllSignals ? newSignals : newSignals.slice(0, 5);
  const signalIds = newSignals.map((sig) => sig.id);
  const selectedSignalIds = signalIds.filter((id) => selectedSignals.has(id));
  const allSignalsSelected = signalIds.length > 0 && selectedSignalIds.length === signalIds.length;

  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: () => api.get("/api/leads", { params: { limit: 200 } }).then((r) => r.data.data ?? []),
  });
  // Leads that came from a signal scan: everything except ICP, company-description and
  // by-name leads, which are listed on the main Lead Discovery page.
  const signalLeads = useMemo(
    () =>
      ((leadsData ?? []) as LeadRow[]).filter(
        (l) =>
          l.source !== "icp_filters" &&
          l.source !== "company_description" &&
          l.source !== "by_name",
      ),
    [leadsData],
  );
  const filteredLeads = signalLeads.filter(
    (l) =>
      (statusFilter === "all" || l.status === statusFilter) &&
      (typeFilter === "all" || l.signalType === typeFilter),
  );

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      // Pass Option 1 ICP titles so backend's founder search ranks them
      // by seniority instead of using the hardcoded "founder" keyword.
      api.post(`/api/discovery/signals/${id}/promote`, { titles: icp.titles }),
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

  const toggleSignalSelect = (id: string) => {
    setSelectedSignals((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllSignals = () => {
    setSelectedSignals((prev) => {
      const next = new Set(prev);
      if (allSignalsSelected) signalIds.forEach((id) => next.delete(id));
      else signalIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const bulkSetSignals = async (ids: string[], action: "approve" | "skip") => {
    if (ids.length === 0) return;
    const results = await Promise.allSettled(
      ids.map((id) =>
        action === "approve" ? approveMutation.mutateAsync(id) : dismissMutation.mutateAsync(id),
      ),
    );
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    if (succeeded) {
      toast.success(
        `${succeeded} signal${succeeded === 1 ? "" : "s"} ${action === "approve" ? "approved" : "skipped"}`,
      );
    }
    setSelectedSignals((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Lead Discovery · By news sources</h1>
        <p className="text-sm text-muted-foreground">
          Scan news feeds for buying signals — funding, key hires, product launches — and approve
          the companies worth pursuing. Approved signals become leads, listed under Leads Results
          below.
        </p>
      </div>

      <CollapsibleSection
        title="By news sources"
        description="Toggle which feeds power your scan."
        defaultOpen
        headerExtra={
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
        }
        primaryAction={
          <Button size="sm" onClick={() => scanMutation.mutate()} disabled={scanMutation.isPending}>
            <Play className="mr-1.5 h-4 w-4" />
            {scanMutation.isPending ? "Scanning..." : "Run signal scan"}
          </Button>
        }
      >
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
        <div className="mt-3 min-h-5">
          {sources.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAllSources((v) => !v)}
              className="text-sm font-medium text-brand-blue hover:underline"
            >
              {showAllSources ? "Hide sources" : `Show all sources (${sources.length})`}
            </button>
          )}
        </div>

        {/* Scan results — same box, same fold, as the sources form above */}
        <div className="mt-6 border-t pt-4">
          <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Zap className="h-4 w-4 shrink-0 text-brand-turquoise" />
              <h3 className="truncate text-sm font-semibold">Signal scan results</h3>
              {newSignals.length > 0 && (
                <span className="shrink-0 rounded-full bg-brand-turquoise/15 px-2 py-0.5 text-xs font-medium text-brand-turquoise">
                  {newSignals.length} new
                </span>
              )}
            </div>
            {newSignals.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllSignals((v) => !v)}
                className="text-sm font-medium text-brand-blue hover:underline"
              >
                {showAllSignals ? "Hide signals" : `Show all signals (${newSignals.length})`}
              </button>
            )}
          </div>

          {signalsLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading signals…</p>
          ) : newSignals.length === 0 ? (
            <EmptyState icon={Zap} message="No new signals. Run a scan to pull fresh results." />
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 p-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-brand-turquoise/40 text-brand-turquoise hover:bg-brand-turquoise/10"
                  onClick={toggleAllSignals}
                >
                  {allSignalsSelected ? "Clear all" : "Select all"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {selectedSignalIds.length} selected
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-brand-turquoise/40 text-brand-turquoise hover:bg-brand-turquoise/10"
                  disabled={selectedSignalIds.length === 0}
                  onClick={() => bulkSetSignals(selectedSignalIds, "approve")}
                >
                  Approve selected
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-brand-turquoise/40 text-brand-turquoise hover:bg-brand-turquoise/10"
                  disabled={selectedSignalIds.length === 0}
                  onClick={() => bulkSetSignals(selectedSignalIds, "skip")}
                >
                  Skip selected
                </Button>
              </div>
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Signal</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleSignals.map((sig) => {
                      const signalType = sig.raw_data?.signal_type;
                      const signalDesc = sig.raw_data?.signal_description;
                      const isApproving =
                        approveMutation.isPending && approveMutation.variables === sig.id;
                      const isDismissing =
                        dismissMutation.isPending && dismissMutation.variables === sig.id;
                      return (
                        <TableRow key={sig.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedSignals.has(sig.id)}
                              onCheckedChange={() => toggleSignalSelect(sig.id)}
                            />
                          </TableCell>
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
                              (signalDesc ?? "—")
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
                          <TableCell className="text-sm text-muted-foreground">
                            {sig.source}
                          </TableCell>
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
                                {isApproving ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  "Approve"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => dismissMutation.mutate(sig.id)}
                                disabled={isApproving || isDismissing}
                              >
                                {isDismissing ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  "Skip"
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

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
          <p className="py-8 text-center text-sm text-muted-foreground">Loading leads…</p>
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
