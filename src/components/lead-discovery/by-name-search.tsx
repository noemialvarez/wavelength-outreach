import { useState } from "react";
import { Search, Loader2, Send, Trash2 } from "lucide-react";
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
import { store, useStore } from "@/lib/store";
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

const PRESET_PURPOSES = [
  "Request expert interview",
  "Apply for a job",
  "Spontaneous job application",
];
const OTHER_VALUE = "__other__";
// Stable reference for the fallback case — `?? []` inline in the selector
// would create a new array every call and loop useSyncExternalStore forever.
const NO_CUSTOM_PURPOSES: string[] = [];

export function ByNameSearch() {
  const queryClient = useQueryClient();
  const customPurposes = useStore((s) => s.customContactPurposes ?? NO_CUSTOM_PURPOSES);
  const purposeOptions = [
    ...PRESET_PURPOSES,
    ...customPurposes.filter((p) => !PRESET_PURPOSES.includes(p)),
  ];

  const [form, setForm] = useState({ firstName: "", lastName: "", purpose: "", company: "" });
  const [showCustomPurposeInput, setShowCustomPurposeInput] = useState(false);
  const [results, setResults] = useState<NameCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [connectingIds, setConnectingIds] = useState<Set<string>>(new Set());

  const handlePurposeSelect = (value: string) => {
    if (value === OTHER_VALUE) {
      setShowCustomPurposeInput(true);
      setForm((f) => ({ ...f, purpose: "" }));
    } else {
      setShowCustomPurposeInput(false);
      setForm((f) => ({ ...f, purpose: value }));
    }
  };

  const saveCustomPurpose = () => {
    const value = form.purpose.trim();
    if (!value || purposeOptions.includes(value)) return;
    store.set((s) => ({
      ...s,
      customContactPurposes: [...(s.customContactPurposes ?? []), value],
    }));
  };

  const searchMutation = useMutation({
    mutationFn: () =>
      api
        .post("/api/discovery/by-name", {
          firstName: form.firstName,
          lastName: form.lastName,
          company: form.company || undefined,
          purpose: form.purpose,
        })
        .then((r) => {
          const d = r.data;
          const raw: Array<Record<string, string>> = Array.isArray(d)
            ? d
            : (d?.data ?? d?.results ?? [d]);
          return raw.filter(Boolean).map((item) => ({
            id:
              item.id ??
              `${form.firstName}-${form.lastName}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            firstName: form.firstName,
            lastName: form.lastName,
            company: item.company ?? form.company ?? "",
            purpose: form.purpose,
            title: item.title ?? item.headline,
            linkedin_url: item.linkedin_url ?? item.url,
          })) as NameCandidate[];
        }),
    onSuccess: (data) => {
      if (!data.length) {
        toast.info("No LinkedIn profile found for that name");
        return;
      }
      setResults((prev) => [...data, ...prev]);
      toast.success(`${data.length} profile${data.length === 1 ? "" : "s"} found`);
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const serverMsg = (err as { response?: { data?: { error?: string } } })?.response?.data
        ?.error;
      const msg =
        serverMsg ??
        (status === 404
          ? "Search failed — backend endpoint not found (404)"
          : "Search failed — check backend connection");
      toast.error(msg);
    },
  });

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
      title="By name LinkedIn connection request"
      description="Search for a specific person on LinkedIn and send a connection request."
      primaryAction={
        <Button
          size="sm"
          disabled={
            searchMutation.isPending ||
            !form.firstName.trim() ||
            !form.lastName.trim() ||
            !form.purpose.trim()
          }
          onClick={() => searchMutation.mutate()}
        >
          {searchMutation.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-1.5 h-4 w-4" />
          )}
          {searchMutation.isPending ? "Searching…" : "Find LinkedIn profile"}
        </Button>
      }
      footer={
        results.length > 0 && (
          <div className="space-y-3 pt-4">
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
        )
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium">Name</label>
          <Input
            value={form.firstName}
            onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            placeholder="e.g. Lena"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Surname</label>
          <Input
            value={form.lastName}
            onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            placeholder="e.g. Krüger"
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium">Purpose of contact</label>
          <Select
            value={showCustomPurposeInput ? OTHER_VALUE : form.purpose || undefined}
            onValueChange={handlePurposeSelect}
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
          {showCustomPurposeInput && (
            <Textarea
              className="mt-2"
              rows={2}
              value={form.purpose}
              onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
              onBlur={saveCustomPurpose}
              placeholder="Type your own reason — it'll be saved for next time"
            />
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">
            Company <span className="text-muted-foreground">(optional)</span>
          </label>
          <Input
            value={form.company}
            onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            placeholder="e.g. Nordlys AI"
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}
