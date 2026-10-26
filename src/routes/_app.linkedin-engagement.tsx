import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  ExternalLink,
  Loader2,
  MessageSquare,
  RefreshCw,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
import { ConnectionCell } from "@/components/lead-discovery/connection-cell";
import { ConnectionRequests } from "@/components/lead-discovery/connection-requests";
import { errorMessage, type Contact } from "@/lib/contacts";
import api from "@/lib/api";

export const Route = createFileRoute("/_app/linkedin-engagement")({
  head: () => ({ meta: [{ title: "LinkedIn Engagement — Wavelength" }] }),
  component: LinkedInEngagementPage,
});

// Set when no posts came back: what the LinkedIn Phantom returned instead.
type PostsNote = { posts_note?: string | null };

function LinkedInEngagementPage() {
  const queryClient = useQueryClient();
  const [loadingAll, setLoadingAll] = useState(false);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts", "selected"],
    queryFn: () =>
      api
        .get("/api/contacts", { params: { selected: true } })
        .then((r) => (r.data.data ?? []) as Contact[]),
  });

  // One group per company: its LinkedIn page first, then the people you selected there.
  const groups = useMemo(() => {
    const map = new Map<string, { company: string; entries: Contact[] }>();
    for (const c of contacts) {
      const g = map.get(c.lead_id) ?? {
        company: c.leads?.company || c.leads?.name || c.name,
        entries: [],
      };
      g.entries.push(c);
      map.set(c.lead_id, g);
    }
    for (const g of map.values()) {
      g.entries.sort((a, b) => Number(b.kind === "company") - Number(a.kind === "company"));
    }
    return [...map.entries()];
  }, [contacts]);

  // Loads posts + summaries one entry at a time — each is a LinkedIn scrape via Phantombuster.
  const loadAll = async () => {
    const todo = contacts.filter((c) => !c.post_summary);
    if (todo.length === 0) return;
    setLoadingAll(true);
    let failed = 0;
    for (const c of todo) {
      try {
        const r = await api.post(`/api/contacts/${c.id}/refresh-posts`);
        if (r.data?.posts_note) toast.info(`${c.name}: ${r.data.posts_note}`, { duration: 15000 });
      } catch {
        failed++;
      }
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    }
    setLoadingAll(false);
    if (failed) toast.error(`${failed} of ${todo.length} entries couldn't be loaded`);
    else toast.success("Posts loaded");
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">LinkedIn Engagement</h1>
          <p className="text-sm text-muted-foreground">
            Company pages and the people you selected in Lead Discovery, with a summary of what they
            post about. Choose “Comment” to get suggested comments you can edit before posting.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={loadingAll || contacts.every((c) => c.post_summary)}
          onClick={loadAll}
        >
          {loadingAll ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-4 w-4" />
          )}
          {loadingAll ? "Loading posts…" : "Load all posts"}
        </Button>
      </div>

      <ConnectionRequests />

      {isLoading ? (
        <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          message="No one selected yet. Select people in Lead Discovery and they'll show up here."
        />
      ) : (
        groups.map(([leadId, g]) => (
          <Card key={leadId} className="p-6">
            <h2 className="mb-3 text-base font-semibold">{g.company}</h2>
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-64">Name</TableHead>
                    <TableHead className="w-28">Connection</TableHead>
                    <TableHead>What they post about</TableHead>
                    <TableHead className="w-40 text-right">Comment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.entries.map((c) => (
                    <EngagementRow key={c.id} contact={c} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        ))
      )}

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

function EngagementRow({ contact: c }: { contact: Contact }) {
  const queryClient = useQueryClient();
  const [commentOpen, setCommentOpen] = useState(false);
  const [text, setText] = useState("");
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["contacts"] });

  const refreshMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/contacts/${c.id}/refresh-posts`).then((r) => r.data as Contact & PostsNote),
    onSuccess: (d) => {
      invalidate();
      if (d.posts_note) toast.info(d.posts_note, { duration: 15000 });
    },
    onError: (err: unknown) => toast.error(errorMessage(err, "Couldn't load posts")),
  });

  const draftMutation = useMutation({
    mutationFn: () => api.post(`/api/contacts/${c.id}/comments/draft`),
    onSuccess: invalidate,
    onError: (err: unknown) => toast.error(errorMessage(err, "Couldn't draft comments")),
  });

  const postMutation = useMutation({
    mutationFn: (body: { post_url: string; body: string }) =>
      api.post(`/api/contacts/${c.id}/comments/post`, body),
    onSuccess: () => {
      toast.success(`Comment posted on ${c.name}'s post`);
      setText("");
      setCommentOpen(false);
      invalidate();
    },
    onError: (err: unknown) => toast.error(errorMessage(err, "Couldn't post the comment")),
  });

  const deselectMutation = useMutation({
    mutationFn: () => api.post(`/api/contacts/${c.id}/deselect`),
    onSuccess: invalidate,
    onError: (err: unknown) => toast.error(errorMessage(err, "Couldn't remove")),
  });

  const suggestions = c.comment_suggestions;
  const hasPosts = c.recent_posts.length > 0;

  // Opening "Comment" proposes comments straight away once posts are loaded.
  useEffect(() => {
    if (commentOpen && hasPosts && !suggestions && !draftMutation.isPending) draftMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentOpen, hasPosts, suggestions]);

  // Start the editable comment from the first proposal.
  useEffect(() => {
    if (suggestions?.options.length && !text) setText(suggestions.options[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions]);

  const isCompany = c.kind === "company";
  const loading = refreshMutation.isPending;

  return (
    <Fragment>
      <TableRow>
        <TableCell>
          <div className="flex items-center gap-1.5 font-medium">
            {isCompany && <Building2 className="h-3.5 w-3.5 text-muted-foreground" />}
            {c.name}
          </div>
          <div className="text-xs text-muted-foreground">{isCompany ? "Company page" : c.role}</div>
          {c.linkedin_url && (
            <a
              href={c.linkedin_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-brand-blue hover:underline"
            >
              LinkedIn <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </TableCell>
        <TableCell>{isCompany ? "—" : <ConnectionCell contact={c} />}</TableCell>
        <TableCell className="text-sm">
          {c.post_summary ? (
            <div className="flex items-start gap-2">
              <p className="flex-1 text-muted-foreground">{c.post_summary}</p>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0 text-muted-foreground"
                title="Reload posts"
                disabled={loading}
                onClick={() => refreshMutation.mutate()}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={() => refreshMutation.mutate()}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Loading posts…
                </>
              ) : (
                "Load posts & summary"
              )}
            </Button>
          )}
          {c.commented_at && (
            <div className="mt-1">
              <StatusBadge label={`Commented ${c.commented_at.slice(0, 10)}`} tone="blue" />
            </div>
          )}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1.5">
            <Button
              size="sm"
              variant={commentOpen ? "default" : "outline"}
              className={
                commentOpen
                  ? undefined
                  : "border-brand-turquoise/40 text-brand-turquoise hover:bg-brand-turquoise/10"
              }
              onClick={() => setCommentOpen((v) => !v)}
            >
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Comment
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              title="Remove from this list"
              disabled={deselectMutation.isPending}
              onClick={() => deselectMutation.mutate()}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {commentOpen && (
        <TableRow>
          <TableCell colSpan={4} className="bg-muted/20">
            {!hasPosts ? (
              <p className="text-sm text-muted-foreground">
                Load {c.name}&apos;s posts first (use “Load posts &amp; summary”) — comments are
                suggested for their latest post.
              </p>
            ) : (
              <div className="space-y-3">
                {suggestions?.post_text && (
                  <blockquote className="rounded-md border-l-2 border-brand-blue bg-background p-3 text-sm italic text-muted-foreground">
                    {suggestions.post_text.length > 400
                      ? `${suggestions.post_text.slice(0, 400)}…`
                      : suggestions.post_text}
                  </blockquote>
                )}

                {draftMutation.isPending && !suggestions ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Suggesting comments…
                  </p>
                ) : (
                  <>
                    {suggestions && suggestions.options.length > 0 && (
                      <div>
                        <div className="mb-1 text-xs font-medium">Suggested comments</div>
                        <div className="flex flex-col gap-2">
                          {suggestions.options.map((opt, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setText(opt)}
                              className="rounded-md border bg-background p-2 text-left text-sm hover:border-brand-turquoise/60"
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="mb-1 block text-xs font-medium">
                        Your comment (edit before posting)
                      </label>
                      <Textarea
                        rows={3}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Pick a suggestion above or write your own"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={draftMutation.isPending}
                        onClick={() => draftMutation.mutate()}
                      >
                        {draftMutation.isPending ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        New suggestions
                      </Button>
                      <Button
                        size="sm"
                        disabled={!text.trim() || !suggestions?.post_url || postMutation.isPending}
                        title={
                          suggestions?.post_url ? undefined : "No link to the post is available"
                        }
                        onClick={() => {
                          if (!suggestions?.post_url) return;
                          if (confirm(`Post this comment on ${c.name}'s LinkedIn post?`)) {
                            postMutation.mutate({ post_url: suggestions.post_url, body: text });
                          }
                        }}
                      >
                        {postMutation.isPending ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        Post comment
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}
