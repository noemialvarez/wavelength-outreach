import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { errorMessage, type Contact } from "@/lib/contacts";
import api from "@/lib/api";

// Adds a founder / executive to a lead by pasting their LinkedIn profile link — for companies the
// automatic lookup has no data on. Once added, the person behaves like any found one: Connection
// check, Select (connection request), LinkedIn Engagement.
export function AddPersonDialog({ leadId, company }: { leadId: string; company: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");

  const addMutation = useMutation({
    mutationFn: () =>
      api
        .post("/api/contacts/add", { lead_id: leadId, linkedin_url: url, name, role })
        .then((r) => r.data as { contact: Contact }),
    onSuccess: ({ contact }) => {
      toast.success(`${contact.name} added to ${company}`);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setUrl("");
      setName("");
      setRole("");
      setOpen(false);
    },
    onError: (err: unknown) => toast.error(errorMessage(err, "Couldn't add the person")),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          title="Add a founder or executive by their LinkedIn link"
        >
          <UserPlus className="mr-1.5 h-3.5 w-3.5" />
          Add person
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a person at {company}</DialogTitle>
          <DialogDescription>
            Paste their LinkedIn profile link. They'll appear in the team list with the same
            Connection check and Select button as anyone found automatically.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!addMutation.isPending) addMutation.mutate();
          }}
        >
          <div>
            <label className="mb-1 block text-xs font-medium">LinkedIn profile link</label>
            <Input
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/first-last"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">
              Name <span className="text-muted-foreground">(optional if it's in the link)</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First Last"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">
              Role <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Founder & CEO"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!url.trim() || addMutation.isPending}>
              {addMutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Add person
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
