import { CollapsibleSection } from "@/components/lead-discovery/collapsible-section";
import { LinkedinPendingConnections } from "@/components/lead-discovery/linkedin-pending-connections";
import { LinkedinMessageQueue } from "@/components/lead-discovery/linkedin-message-queue";
import { LinkedinReminders } from "@/components/lead-discovery/linkedin-reminders";
import { EmailEscalation } from "@/components/lead-discovery/email-escalation";

// What happens after you contact someone by name (Option 3): requests waiting for a reply,
// messages to send once someone accepts, reminders, and the email fallback.
export function LinkedinFollowUp() {
  return (
    <CollapsibleSection
      eyebrow="Option 3"
      title="LinkedIn follow-up"
      description="For people you contacted by name: connection requests waiting for a reply, messages to send once someone accepts, reminders, and the email fallback."
    >
      <div className="space-y-6">
        <LinkedinPendingConnections />
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
