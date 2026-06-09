import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MessageCircle, Plus, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import api from "@/lib/api";

export const Route = createFileRoute("/_app/prospect-engagement")({
  head: () => ({ meta: [{ title: "Prospect Engagement — Wavelength" }] }),
  component: ProspectEngagementPage,
});

type Prospect = { id: string; name?: string; company?: string; linkedin_url: string; created_at: string; };
type Comment = {
  id: string; body: string; status: string;
  watched_prospects?: { name?: string };
  prospect_activity?: { content?: string; post_url?: string };
};

function ProspectEngagementPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [localEdits, setLocalEdits] = useState<Record<string, string>>({});

  const { data: prospects = [], isLoading: prospectsLoading } = useQuery<Prospect[]>({
    queryKey: ["prospects"],
    queryFn: () => api.get("/api/engagement/prospects").then((r) => r.data),
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery<Comment[]>({
    queryKey: ["comments", "draft"],
    queryFn: () => api.get("/api/engagement/comments", { params: { status: "draft" } }).then((r) => r.data),
  });

  const addProspectMutation = useMutation({
    mutationFn: () => api.post("/api/engagement/prospects", { name, linkedin_url: url }),
    onSuccess: () => {
      toast.success("Prospect added");
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      setName(""); setUrl(""); setDialogOpen(false);
    },
    onError: () => toast.error("Failed to add prospect"),
  });

  const removeProspectMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/engagement/prospects/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prospects"] }),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post("/api/engagement/activity/sync"),
    onSuccess: (r) => {
      toast.success(`Synced ${r.data.synced} new activities`);
      queryClient.invalidateQueries({ queryKey: ["comments"] });
    },
    onError: () => toast.error("Sync failed — check Phantombuster config"),
  });

  const updateCommentMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api.patch(`/api/engagement/comments/${id}`, { body }),
  });

  const approveCommentMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/engagement/comments/${id}/approve`),
    onSuccess: () => {
      toast.success("Comment posted");
      queryClient.invalidateQueries({ queryKey: ["comments"] });
    },
    onError: () => toast.error("Failed to post comment"),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/engagement/comments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comments"] }),
  });

  const getBody = (c: Comment) => localEdits[c.id] ?? c.body;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Prospect Engagement</h1>
        <p className="text-sm text-muted-foreground">
          Stay top-of-mind with thoughtful comments on prospects' posts.
        </p>
      </div>

      {/* Watch list */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Watch list</h2>
            <p className="text-xs text-muted-foreground">
              {prospects.length} prospects being monitored
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              {syncMutation.isPending ? "Syncing…" : "Sync activity"}
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-1.5 h-4 w-4" /> Add prospect
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add prospect</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium">Name</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">LinkedIn URL</label>
                    <Input value={url} onChange={(e) => setUrl(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={() => addProspectMutation.mutate()} disabled={addProspectMutation.isPending}>
                    Add
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {prospectsLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : prospects.length === 0 ? (
          <EmptyState icon={MessageCircle} message="No prospects being watched yet." />
        ) : (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>LinkedIn</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prospects.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name || "—"}</TableCell>
                    <TableCell>{p.company || "—"}</TableCell>
                    <TableCell>
                      {p.linkedin_url && (
                        <a href={p.linkedin_url} target="_blank" rel="noreferrer" className="text-sm text-brand-blue hover:underline">
                          View
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.created_at?.slice(0, 10)}</TableCell>
                    <TableCell>
                      <StatusBadge label="Active" tone="turquoise" />
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => removeProspectMutation.mutate(p.id)}>
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Engagement queue */}
      <div>
        <h2 className="mb-3 text-base font-semibold">Engagement queue</h2>
        {commentsLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : comments.length === 0 ? (
          <EmptyState icon={MessageCircle} message="No draft comments. Sync activity to pull recent posts." />
        ) : (
          <div className="space-y-4">
            {comments.map((c) => (
              <Card key={c.id} className="p-6">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{c.watched_prospects?.name}</h3>
                  </div>
                  {c.prospect_activity?.post_url && (
                    <a
                      href={c.prospect_activity.post_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-brand-blue hover:underline"
                    >
                      View post <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                {c.prospect_activity?.content && (
                  <blockquote className="mb-4 rounded-md border-l-2 border-brand-blue bg-muted/30 p-3 text-sm italic text-muted-foreground">
                    {c.prospect_activity.content}
                  </blockquote>
                )}
                <label className="mb-1 block text-xs font-medium">Drafted comment</label>
                <Textarea
                  rows={3}
                  value={getBody(c)}
                  onChange={(e) => setLocalEdits((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  onBlur={() => {
                    const body = localEdits[c.id];
                    if (body && body !== c.body) updateCommentMutation.mutate({ id: c.id, body });
                  }}
                />
                <div className="mt-4 flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => deleteCommentMutation.mutate(c.id)}>
                    Skip
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-brand-turquoise/40 text-brand-turquoise hover:bg-brand-turquoise/10"
                    onClick={() => deleteCommentMutation.mutate(c.id)}
                  >
                    Like only
                  </Button>
                  <Button size="sm" onClick={() => approveCommentMutation.mutate(c.id)} disabled={approveCommentMutation.isPending}>
                    Approve comment
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
