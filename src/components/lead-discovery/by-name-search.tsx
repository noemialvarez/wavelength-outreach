import { useState } from "react";
import { Search, Loader2, Send, Trash2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { CollapsibleSection } from "@/components/lead-discovery/collapsible-section";
import { NameSearchLeads } from "@/components/lead-discovery/name-search-leads";
import { LinkedinPendingConnections } from "@/components/lead-discovery/linkedin-pending-connections";
import { LinkedinMessageQueue } from "@/components/lead-discovery/linkedin-message-queue";
import { LinkedinReminders } from "@/components/lead-discovery/linkedin-reminders";
import { EmailEscalation } from "@/components/lead-discovery/email-escalation";
import { store, useStore, uid } from "@/lib/store";
import api from "@/lib/api";

type NameCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  purpose: string;
  title?: string;
  linkedin_url?: string;
};

type SearchRow = {
  id: string;
  firstName: string;
  lastName: string;
  purpose: string;
  company: string;
  showCustomPurposeInput: boolean;
};

const PRESET_PURPOSES = [
  "Request expert interview",
  "Apply for a job",
  "Spontaneous job application",
];
const OTHER_VALUE = "__other__";
// Stable reference for the fallback case — `?? []` inline in the selector
// would create a new array every call and loop useSyncExternalStore forever.
const NO_CUSTOM_PURPOSES: string[] = [];

const emptyRow = (): SearchRow => ({
  id: uid(),
  firstName: "",
  lastName: "",
  purpose: "",
  company: "",
  showCustomPurposeInput: false,
});

export function ByNameSearch() {
  const queryClient = useQueryClient();
  const customPurposes = useStore((s) => s.customContactPurposes ?? NO_CUSTOM_PURPOSES);
  const purposeOptions = [
    ...PRESET_PURPOSES,
    ...customPurposes.filter((p) => !PRESET_PURPOSES.includes(p)),
  ];

  const [rows, setRows] = useState<SearchRow[]>([emptyRow()]);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<NameCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [connectingIds, setConnectingIds] = useState<Set<string>>(new Set());

  const updateRow = (id: string, patch: Partial<SearchRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const handlePurposeSelect = (rowId: string, value: string) => {
    if (value === OTHER_VALUE) {
      updateRow(rowId, { showCustomPurposeInput: true, purpose: "" });
    } else {
      updateRow(rowId, { showCustomPurposeInput: false, purpose: value });
    }
  };

  const saveCustomPurpose = (purpose: string) => {
    const value = purpose.trim();
    if (!value || purposeOptions.includes(value)) return;
    store.set((s) => ({
      ...s,
      customContactPurposes: [...(s.customContactPurposes ?? []), value],
    }));
  };

  const searchOne = (row: SearchRow) =>
    api
      .post("/api/discovery/by-name", {
        firstName: row.firstName,
        lastName: row.lastName,
        company: row.company || undefined,
        purpose: row.purpose,
      })
      .then((r) => {
        const d = r.data;
        const raw: Array<Record<string, string>> = Array.isArray(d)
          ? d
          : (d?.data ?? d?.results ?? [d]);
        return raw.filter(Boolean).map((item) => ({
          id:
            item.id ??
            `${row.firstName}-${row.lastName}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          firstName: row.firstName,
          lastName: row.lastName,
          company: item.company ?? row.company ?? "",
          purpose: row.purpose,
          title: item.title ?? item.headline,
          linkedin_url: item.linkedin_url ?? item.url,
        })) as NameCandidate[];
      });

  const runSearch = async () => {
    const validRows = rows.filter(
      (r) => r.firstName.trim() && r.lastName.trim() && r.purpose.trim(),
    );
    if (validRows.length === 0) return;
    setIsSearching(true);
    let found = 0;
    let failed = 0;
    for (const row of validRows) {
      try {
        const candidates = await searchOne(row);
        if (candidates.length) {
          setResults((prev) => [...candidates, ...prev]);
          found += candidates.length;
        }
      } catch (err: unknown) {
        failed++;
        const status = (err as { response?: { status?: number } })?.response?.status;
        const serverMsg = (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error;
        const msg =
          serverMsg ??
          (status === 404
            ? "Search failed — backend endpoint not found (404)"
            : "Search failed — check backend connection");
        toast.error(`${row.firstName} ${row.lastName}: ${msg}`);
      }
    }
    setIsSearching(false);
    if (found) toast.success(`${found} profile${found === 1 ? "" : "s"} found`);
    else if (!failed) toast.info("No LinkedIn profiles found");
  };

  const connectMutation = useMutation({
    mutationFn: (candidate: NameCandidate) =>
      api.post("/api/leads/by-name/connect", { candidate, purpose: candidate.purpose }),
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = results.length > 0 && results.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(results.map((r) => r.id)));

  const deleteSelected = () => {
    setResults((prev) => prev.filter((r) => !selected.has(r.id)));
    setSelected(new Set());
  };

  const sendConnectionRequests = async (ids: string[]) => {
    if (ids.length === 0 || connectingIds.size > 0) return;
    setConnectingIds(new Set(ids));
    let sent = 0;
    let failed = 0;
    for (const id of ids) {
      const candidate = results.find((r) => r.id === id);
      if (!candidate) continue;
      try {
        await connectMutation.mutateAsync(candidate);
        sent++;
      } catch {
        failed++;
      }
      setConnectingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    setResults((prev) => prev.filter((r) => !ids.includes(r.id)));
    setSelected(new Set());
    toast.success(
      `${sent} connection request${sent === 1 ? "" : "s"} sent${failed ? `, ${failed} failed` : ""}`,
    );
  };

  return (
    <CollapsibleSection
      eyebrow="Option 4"
      title="By name LinkedIn outreach"
      description="Search for one or more specific people on LinkedIn, send connection requests, and run the whole outreach funnel through to email escalation — all in one place."
      primaryAction={
        <Button size="sm" disabled={isSearching} onClick={runSearch}>
          {isSearching ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-1.5 h-4 w-4" />
          )}
          {isSearching ? "Searching…" : `Find LinkedIn profile${rows.length === 1 ? "" : "s"}`}
        </Button>
      }
    >
      <div className="space-y-4">
        {rows.map((row, i) => (
          <div key={row.id} className="rounded-md border bg-muted/10 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Person {i + 1}</span>
              {rows.length > 1 && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => removeRow(row.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium">Name</label>
                <Input
                  value={row.firstName}
                  onChange={(e) => updateRow(row.id, { firstName: e.target.value })}
                  placeholder="e.g. Lena"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Surname</label>
                <Input
                  value={row.lastName}
                  onChange={(e) => updateRow(row.id, { lastName: e.target.value })}
                  placeholder="e.g. Krüger"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium">Purpose of contact</label>
                <Select
                  value={row.showCustomPurposeInput ? OTHER_VALUE : row.purpose || undefined}
                  onValueChange={(value) => handlePurposeSelect(row.id, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a purpose" />
                  </SelectTrigger>
                  <SelectContent>
                    {purposeOptions.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                    <SelectItem value={OTHER_VALUE}>Other…</SelectItem>
                  </SelectContent>
                </Select>
                {row.showCustomPurposeInput && (
                  <Textarea
                    className="mt-2"
                    rows={2}
                    value={row.purpose}
                    onChange={(e) => updateRow(row.id, { purpose: e.target.value })}
                    onBlur={() => saveCustomPurpose(row.purpose)}
                    placeholder="Type your own reason — it'll be saved for next time"
                  />
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">
                  Company <span className="text-muted-foreground">(optional)</span>
                </label>
                <Input
                  value={row.company}
                  onChange={(e) => updateRow(row.id, { company: e.target.value })}
                  placeholder="e.g. Nordlys AI"
                />
              </div>
            </div>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={addRow}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add another person
        </Button>
      </div>
      <div className="space-y-6 pt-4">
        {results.length > 0 && (
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
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                disabled={selected.size === 0}
                onClick={deleteSelected}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete selected
              </Button>
              <Button
                size="sm"
                className="ml-auto"
                disabled={selected.size === 0 || connectingIds.size > 0}
                onClick={() => sendConnectionRequests(Array.from(selected))}
              >
                {connectingIds.size > 0 ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Sending… ({connectingIds.size} left)
                  </>
                ) : (
                  <>
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    Send connection request{selected.size === 1 ? "" : "s"}
                  </>
                )}
              </Button>
            </div>
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>LinkedIn</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(r.id)}
                          onCheckedChange={() => toggleSelect(r.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {r.firstName} {r.lastName}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.title ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.company || "—"}
                      </TableCell>
                      <TableCell>
                        {r.linkedin_url ? (
                          <a
                            href={r.linkedin_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-brand-blue hover:underline"
                          >
                            View
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-brand-turquoise/40 text-brand-turquoise hover:bg-brand-turquoise/10"
                          disabled={connectingIds.size > 0}
                          onClick={() => sendConnectionRequests([r.id])}
                        >
                          {connectingIds.has(r.id) ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            "Send connection request"
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

        {/* The rest of the Option 4 funnel — all one box, one fold */}
        <div className="border-t pt-6">
          <NameSearchLeads />
        </div>
        <div className="border-t pt-6">
          <LinkedinPendingConnections />
        </div>
        <div className="border-t pt-6">
          <LinkedinMessageQueue />
        </div>
        <div className="border-t pt-6">
          <LinkedinReminders />
        </div>
        <div className="border-t pt-6">
          <EmailEscalation />
        </div>
      </div>
    </CollapsibleSection>
  );
}
