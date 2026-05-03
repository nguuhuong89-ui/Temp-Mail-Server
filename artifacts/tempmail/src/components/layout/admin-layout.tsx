import { Link, useLocation } from "wouter";
import { LayoutDashboard, Globe, Mail, Megaphone, Settings, ArrowLeft, ShieldAlert } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { AdminGate, AdminLogoutButton } from "@/components/admin-gate";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGate>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminGate>
  );
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const nav = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/domains", label: "Domains", icon: Globe },
    { href: "/admin/emails", label: "Emails", icon: Mail },
    { href: "/admin/ads", label: "Campaigns", icon: Megaphone },
    { href: "/admin/blocklist", label: "Blocklist", icon: ShieldAlert },
    { href: "/admin/setup", label: "Setup Guide", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-muted/20 text-foreground">
      <aside className="w-full md:w-64 border-r bg-background md:min-h-screen flex flex-col sticky top-0">
        <div className="h-16 flex items-center px-6 border-b">
          <span className="font-bold text-lg flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" /> Console
          </span>
        </div>
        <div className="p-4 flex-1">
          <nav className="space-y-1">
            {nav.map((item) => {
              const active = location === item.href || (item.href !== "/admin" && location.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground"
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
            <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to App
            </Link>
            <ThemeToggle />
          </div>
          <AdminLogoutButton />
        </div>
      </aside>
      <main className="flex-1 p-6 md:p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
