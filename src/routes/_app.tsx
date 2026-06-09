import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { PasswordGate } from "@/components/password-gate";
import { isUnlocked } from "@/lib/auth-gate";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const [unlocked, setUnlocked] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setUnlocked(isUnlocked());
    setHydrated(true);
  }, []);

  if (!hydrated) return null;
  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto bg-background">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
