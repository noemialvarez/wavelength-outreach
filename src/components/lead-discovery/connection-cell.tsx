import { StatusBadge } from "@/components/status-badge";
import type { Contact } from "@/lib/contacts";

// "Yes" / "No" for whether you're connected with this person on LinkedIn. When it hasn't been
// confirmed it says "Unknown" (never a guessed "No"), with a tooltip on how to resolve it. Under
// "No" / "Unknown" it also shows whether a connection request has been sent, since an unanswered
// invitation doesn't make you a connection yet.
export function ConnectionCell({ contact }: { contact: Contact }) {
  if (contact.connection === "yes") return <StatusBadge label="Yes" tone="turquoise" />;
  const sentOn = contact.requested_at ? contact.requested_at.slice(0, 10) : null;
  return (
    <div>
      {contact.connection === "no" ? (
        <StatusBadge label="No" tone="muted" />
      ) : (
        <span
          className="text-sm text-muted-foreground"
          title="Not confirmed yet — click “Refresh connections” above the table to check against your LinkedIn connections list"
        >
          Unknown
        </span>
      )}
      {contact.request_status === "requested" && (
        <div
          className="mt-0.5 text-xs text-muted-foreground"
          title="Waiting for them to accept. “Refresh connections” updates this once they have."
        >
          Request sent{sentOn ? ` ${sentOn}` : ""} · pending
        </div>
      )}
      {contact.request_status === "failed" && (
        <div className="mt-0.5 text-xs text-destructive" title={contact.request_error ?? ""}>
          Request failed
        </div>
      )}
    </div>
  );
}
