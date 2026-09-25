import { Link, useRouterState } from "@tanstack/react-router";
import { Radar, Mail, MessageCircle, Activity, UserCheck } from "lucide-react";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

type NavItem = {
  title: string;
  url: string;
  icon: typeof Radar;
  children?: { title: string; url: string }[];
};

const items: NavItem[] = [
  {
    title: "Lead Discovery",
    url: "/lead-discovery",
    icon: Radar,
    children: [{ title: "By news sources", url: "/lead-discovery/news-sources" }],
  },
  { title: "LinkedIn Engagement", url: "/linkedin-engagement", icon: UserCheck },
  { title: "Email Outreach", url: "/email-outreach", icon: Mail },
  { title: "Campaign Monitor", url: "/sequence-monitor", icon: Activity },
];

const secondaryItems = [
  { title: "Prospect Engagement", url: "/prospect-engagement", icon: MessageCircle },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar collapsible="none" className="border-r-0">
      <SidebarHeader className="px-4 py-5">
        <div className="flex flex-col items-center gap-3">
          <img src={logoUrl} alt="InsightSphere" className="h-10 w-auto" />
          <span className="text-sm font-semibold tracking-wide text-sidebar-foreground">
            Outreach Hub
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                // A parent with sub-items is only active on its own page; the sub-item
                // highlights itself.
                const active = item.children
                  ? pathname === item.url
                  : pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} className="h-10">
                      <Link to={item.url} className="flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
                        <span className="text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.children && (
                      <SidebarMenuSub>
                        {item.children.map((child) => (
                          <SidebarMenuSubItem key={child.url}>
                            <SidebarMenuSubButton asChild isActive={pathname === child.url}>
                              <Link to={child.url}>
                                <span>{child.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-8 border-t border-sidebar-border pt-4">
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryItems.map((item) => {
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
