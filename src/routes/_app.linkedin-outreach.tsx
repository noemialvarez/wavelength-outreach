import { createFileRoute } from "@tanstack/react-router";
import { LinkedinMessageQueue } from "@/components/lead-discovery/linkedin-message-queue";

export const Route = createFileRoute("/_app/linkedin-outreach")({
  head: () => ({ meta: [{ title: "LinkedIn Outreach — Wavelength" }] }),
  component: LinkedinOutreachPage,
});

function LinkedinOutreachPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Outreach · LinkedIn outreach</h1>
        <p className="text-sm text-muted-foreground">
          Messages ready to send to people who accepted your connection request.
        </p>
      </div>
      <LinkedinMessageQueue />
    </div>
  );
}
