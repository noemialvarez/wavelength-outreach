import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
  const mainRef = useRef<HTMLElement>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setUnlocked(isUnlocked());
    setHydrated(true);
  }, []);

  // The page area scrolls (not the browser window), so go back to the top when changing page.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  if (!hydrated) return null;
  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;

  return (
    <SidebarProvider>
      {/* Fixed to the window's height, with the sidebar staying put and only the page area scrolling.
          That way anything "stuck to the bottom" of the page area (like a wide table's horizontal
          scrollbar) is stuck to the bottom of the window, wherever you are on the page. */}
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <main ref={mainRef} className="flex-1 overflow-y-auto bg-background">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
