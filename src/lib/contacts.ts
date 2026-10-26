// A person at a lead's company (founder / executive team member), or the company's
// LinkedIn page (kind "company"). Mirrors the backend's lead_contacts table.
export type ContactPost = {
  text: string;
  post_url: string | null;
  date: string | null;
  type: string;
};

export type Contact = {
  id: string;
  lead_id: string;
  kind: "person" | "company";
  name: string;
  role: string | null;
  linkedin_url: string | null;
  is_founder: boolean;
  // "unknown" means it couldn't be verified — never shown as "no".
  connection: "yes" | "no" | "unknown";
  selected: boolean;
  request_status: "none" | "requested" | "failed";
  request_error: string | null;
  requested_at: string | null;
  recent_posts: ContactPost[];
  post_summary: string | null;
  post_summary_at: string | null;
  comment_suggestions: { post_url: string | null; post_text: string; options: string[] } | null;
  last_comment: string | null;
  commented_at: string | null;
  leads?: { id: string; company: string | null; name: string | null; status: string } | null;
};

export function errorMessage(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}
