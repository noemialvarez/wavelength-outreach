import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Play, Radar, Trash2, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
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
import { store, useStore, uid, type SignalType, type LeadStatus } from "@/lib/store";
import api from "@/lib/api";

export const Route = createFileRoute("/_app/lead-discovery")({
  head: () => ({ meta: [{ title: "Lead Discovery — Wavelength" }] }),
  component: LeadDiscoveryPage,
});

const signalTones: Record<SignalType, "turquoise" | "pink" | "blue" | "muted"> = {
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

function LeadDiscoveryPage() {
  const sources = useStore((s) => s.sources);
  const icp = useStore((s) => s.icp);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [localEmails, setLocalEmails] = useState<Record<string, string>>({});

  const queryClient = useQueryClient();

  const { data: leadsData, isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: () => api.get("/api/leads", { params: { limit: 200 } }).then((r) => r.data.data ?? []),
  });
  const leads = leadsData ?? [];

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

  const scanMutation = useMutation({
    mutationFn: () => {
      const enabledSources = sources
        .filter((s) => s.enabled)
        .map((s) => s.name.toLowerCase().replace(/\s+/g, ""));
      return api.post("/api/discovery/runs", { sources: enabledSources });
    },
    onSuccess: () => {
      toast.success("Signal scan started — results will appear shortly");
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["leads"] }), 8000);
    },
    onError: () => toast.error("Scan failed — check backend connection"),
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

      {/* Sources */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Sources</h2>
            <p className="text-xs text-muted-foreground">Toggle which feeds power your scan.</p>
          </div>
          <div className="flex gap-2">
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
            <Button size="sm" onClick={() => scanMutation.mutate()} disabled={scanMutation.isPending}>
              <Play className="mr-1.5 h-4 w-4" />
              {scanMutation.isPending ? "Scanning..." : "Run signal scan"}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          {sources.map((src) => (
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
      </Card>

      {/* ICP filters */}
      <Card className="p-6">
        <div className="mb-4">
          <h2 className="text-base font-semibold">ICP filters</h2>
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
            <Input
              value={icp.industries.join(", ")}
              onChange={(e) =>
                store.set((s) => ({
                  ...s,
                  icp: {
                    ...s.icp,
                    industries: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                  },
                }))
              }
              placeholder="SaaS, Fintech"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">
              Company size <span className="text-muted-foreground">(optional)</span>
            </label>
            <Select
              value={icp.companySize || "any"}
              onValueChange={(v) =>
                store.set((s) => ({ ...s, icp: { ...s.icp, companySize: v === "any" ? "" : v } }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any size</SelectItem>
                <SelectItem value="1-10">1-10</SelectItem>
                <SelectItem value="11-50">11-50</SelectItem>
                <SelectItem value="51-200">51-200</SelectItem>
                <SelectItem value="201-500">201-500</SelectItem>
              </SelectContent>
            </Select>
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

        {isLoading ? (
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
                        <StatusBadge label={l.signalType} tone={signalTones[l.signalType]} />
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
    </div>
  );
}
