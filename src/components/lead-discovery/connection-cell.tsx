import { StatusBadge } from "@/components/status-badge";
import type { Contact } from "@/lib/contacts";

// "Yes" / "No" for whether you're connected with this person on LinkedIn. When the
// status couldn't be verified it shows a dash rather than a wrong "No".
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
      title="Couldn't verify — the connections list isn't available or this profile link can't be matched"
    >
      —
    </span>
  );
}
