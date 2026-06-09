import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MessageCircle, Plus, ExternalLink } from "lucide-react";
import { toast } from "sonner";
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
import { store, useStore, uid } from "@/lib/store";

export const Route = createFileRoute("/_app/prospect-engagement")({
  head: () => ({ meta: [{ title: "Prospect Engagement — InsightSphere" }] }),
  component: ProspectEngagementPage,
});

function ProspectEngagementPage() {
  const prospects = useStore((s) => s.prospects);
  const engagement = useStore((s) => s.engagement);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const addProspect = () => {
    if (!name.trim()) return;
    store.set((s) => ({
      ...s,
      prospects: [
        ...s.prospects,
        {
          id: uid(),
          name,
          company: "",
          linkedinUrl: url,
          addedDate: new Date().toISOString().slice(0, 10),
          lastActivity: "—",
          status: "Active",
        },
      ],
    }));
    setName("");
    setUrl("");
    setOpen(false);
    toast.success("Prospect added");
  };

  const removeEngagement = (id: string, msg: string) => {
    store.set((s) => ({ ...s, engagement: s.engagement.filter((e) => e.id !== id) }));
    toast.success(msg);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Prospect Engagement</h1>
        <p className="text-sm text-muted-foreground">
          Stay top-of-mind with thoughtful comments on prospects' posts.
        </p>
      </div>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Watch list</h2>
            <p className="text-xs text-muted-foreground">
              {prospects.length} prospects being monitored
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-1.5 h-4 w-4" /> Add prospect manually
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
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={addProspect}>Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {prospects.length === 0 ? (
          <EmptyState icon={MessageCircle} message="No prospects being watched yet." />
        ) : (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead>Last activity</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prospects.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.company || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.addedDate}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.lastActivity}
                    </TableCell>
                    <TableCell>
                      <StatusBadge label={p.status} tone={p.status === "Active" ? "turquoise" : "muted"} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <div>
        <h2 className="mb-3 text-base font-semibold">Engagement queue</h2>
        {engagement.length === 0 ? (
          <EmptyState icon={MessageCircle} message="No recent posts to engage with." />
        ) : (
          <div className="space-y-4">
            {engagement.map((e) => (
              <Card key={e.id} className="p-6">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{e.prospectName}</h3>
                    <p className="text-sm text-muted-foreground">{e.company}</p>
                  </div>
                  <a
                    href={e.postUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-brand-blue hover:underline"
                  >
                    View post <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <blockquote className="mb-4 rounded-md border-l-2 border-brand-blue bg-muted/30 p-3 text-sm italic text-muted-foreground">
                  {e.snippet}
                </blockquote>
                <label className="mb-1 block text-xs font-medium">Drafted comment</label>
                <Textarea
                  rows={3}
                  value={e.draftComment}
                  onChange={(ev) =>
                    store.set((s) => ({
                      ...s,
                      engagement: s.engagement.map((x) =>
                        x.id === e.id ? { ...x, draftComment: ev.target.value } : x,
                      ),
                    }))
                  }
                />
                <div className="mt-4 flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => removeEngagement(e.id, "Skipped")}>
                    Skip
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-brand-turquoise/40 text-brand-turquoise hover:bg-brand-turquoise/10"
                    onClick={() => removeEngagement(e.id, "Liked")}
                  >
                    Like only
                  </Button>
                  <Button size="sm" onClick={() => removeEngagement(e.id, "Comment posted")}>
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
