import { Link, useRouterState } from "@tanstack/react-router";
import { Radar, Mail, MessageCircle, Activity } from "lucide-react";
import logoUrl from "@/assets/logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";

const items = [
  { title: "Lead Discovery", url: "/lead-discovery", icon: Radar },
  { title: "Email Outreach", url: "/email-outreach", icon: Mail },
  { title: "Prospect Engagement", url: "/prospect-engagement", icon: MessageCircle },
  { title: "Sequence Monitor", url: "/sequence-monitor", icon: Activity },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar collapsible="none" className="border-r-0">
      <SidebarHeader className="px-4 py-5">
        <div className="flex flex-col items-center gap-2">
          <img src={logoUrl} alt="InsightSphere" className="h-10 w-auto" />
          <span className="text-sm font-semibold tracking-wide text-sidebar-foreground">
            Outreach Hub
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel>Outreach Hub</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} className="h-10">
                      <Link to={item.url} className="flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
                        <span className="text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
