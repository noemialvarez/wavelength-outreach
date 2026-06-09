import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { APP_PASSWORD, unlock } from "@/lib/auth-gate";
import logoDark from "@/assets/logo-dark.png";

export function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value === APP_PASSWORD) {
      unlock();
      onUnlock();
    } else {
      setError(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <img src={logoDark} alt="InsightSphere" className="h-10 w-auto" />
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Outreach Hub</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Input
            type="password"
            placeholder="Enter password"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(false);
            }}
            autoFocus
          />
          {error && <p className="text-xs text-destructive">Incorrect password.</p>}
          <Button type="submit" className="w-full">
            Unlock
          </Button>
        </form>
      </Card>
    </div>
  );
}
