import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Globe,
  Mail,
  Megaphone,
  Settings,
  ArrowLeft,
  ShieldAlert,
  Key,
  Code2,
  Users,
  Menu,
  ChevronRight,
  Inbox,
  SlidersHorizontal,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { AdminGate, AdminLogoutButton } from "@/components/admin-gate";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/domains", label: "Domains", icon: Globe },
  { href: "/admin/inboxes", label: "Inboxes", icon: Inbox },
  { href: "/admin/emails", label: "Emails", icon: Mail },
  { href: "/admin/ads", label: "Campaigns", icon: Megaphone },
  { href: "/admin/blocklist", label: "Blocklist", icon: ShieldAlert },
  { href: "/admin/api-keys", label: "API Keys", icon: Key },
  { href: "/admin/api-docs", label: "API Docs", icon: Code2 },
  { href: "/admin/setup", label: "Setup Guide", icon: Settings },
  { href: "/admin/settings", label: "Settings", icon: SlidersHorizontal },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGate>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminGate>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Logo area */}
      <div className="h-16 flex items-center px-5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Mail className="h-4.5 w-4.5 text-white h-4 w-4" />
          </div>
          <div>
            <div className="font-bold text-white text-sm leading-none">TempMail</div>
            <div className="text-[10px] text-white/40 font-medium tracking-widest uppercase mt-0.5">Console</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-0.5">
          {NAV.map((item) => {
            const active = item.exact
              ? location === item.href
              : location === item.href || location.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                  active
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20"
                    : "text-white/50 hover:text-white hover:bg-white/8"
                }`}
                style={!active ? {} : {}}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-white/40 group-hover:text-white/70"}`} />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight className="h-3.5 w-3.5 text-white/60" />}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-white/10 space-y-2 shrink-0">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/40 hover:text-white hover:bg-white/8 transition-all w-full"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to App
        </Link>
        <div className="flex items-center justify-between px-3">
          <AdminLogoutButton />
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  const currentPage = NAV.find((n) =>
    n.exact ? location === n.href : location === n.href || location.startsWith(n.href + "/")
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 text-foreground">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 h-14 border-b bg-slate-900 flex items-center gap-3 px-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu" className="text-white/70 hover:text-white hover:bg-white/10">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 flex flex-col border-r border-white/10 bg-slate-900">
            <SheetTitle className="sr-only">Admin menu</SheetTitle>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Mail className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-bold text-white text-sm">{currentPage?.label ?? "Console"}</span>
        </div>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 min-h-screen flex-col sticky top-0 border-r border-white/5 shadow-xl shadow-black/20">
        <SidebarContent />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
