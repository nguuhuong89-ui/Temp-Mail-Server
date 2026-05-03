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
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { AdminGate, AdminLogoutButton } from "@/components/admin-gate";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/domains", label: "Domains", icon: Globe },
  { href: "/admin/emails", label: "Emails", icon: Mail },
  { href: "/admin/ads", label: "Campaigns", icon: Megaphone },
  { href: "/admin/blocklist", label: "Blocklist", icon: ShieldAlert },
  { href: "/admin/api-keys", label: "API Keys", icon: Key },
  { href: "/admin/api-docs", label: "API Docs", icon: Code2 },
  { href: "/admin/setup", label: "Setup Guide", icon: Settings },
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
    <>
      <div className="h-16 flex items-center px-6 border-b">
        <span className="font-bold text-lg flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" /> Console
        </span>
      </div>
      <div className="p-4 flex-1 overflow-y-auto">
        <nav className="space-y-1">
          {NAV.map((item) => {
            const active =
              location === item.href ||
              (item.href !== "/admin" && location.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="p-4 border-t flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            onClick={onNavigate}
            className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to App
          </Link>
          <ThemeToggle />
        </div>
        <AdminLogoutButton />
      </div>
    </>
  );
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-muted/20 text-foreground">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 h-14 border-b bg-background/95 backdrop-blur flex items-center gap-3 px-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 flex flex-col">
            <SheetTitle className="sr-only">Admin menu</SheetTitle>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="font-bold text-base flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" /> Console
        </span>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 border-r bg-background min-h-screen flex-col sticky top-0">
        <SidebarContent />
      </aside>
      <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
