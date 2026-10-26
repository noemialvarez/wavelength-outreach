import { StatusBadge } from "@/components/status-badge";
import type { Contact } from "@/lib/contacts";

// "Yes" / "No" for whether you're connected with this person on LinkedIn. When it hasn't been
// confirmed it says "Unknown" (never a guessed "No"), with a tooltip on how to resolve it.
export function ConnectionCell({ contact }: { contact: Contact }) {
  if (contact.connection === "yes") return <StatusBadge label="Yes" tone="turquoise" />;
  if (contact.connection === "no") {
    return (
      <div>
        <StatusBadge label="No" tone="muted" />
        {contact.request_status === "requested" && (
          <div className="mt-0.5 text-xs text-muted-foreground">Request sent</div>
        )}
        {contact.request_status === "failed" && (
          <div className="mt-0.5 text-xs text-destructive" title={contact.request_error ?? ""}>
            Request failed
          </div>
        )}
      </div>
    );
  }
  return (
    <span
      className="text-sm text-muted-foreground"
      title="Not confirmed yet — click “Refresh connections” above the table to check against your LinkedIn connections list"
    >
      Unknown
    </span>
  );
}
