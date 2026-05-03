import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Inbox as InboxIcon,
  Key,
  Globe,
  Crown,
  ArrowLeft,
  LogOut,
  Mail,
  Menu,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type Me = { id: string; plan: "free" | "pro"; role: "user" | "admin"; email: string | null };

export function useMe() {
  return useQuery<Me>({
    queryKey: ["/account/me"],
    queryFn: () => apiFetch<Me>("/api/account/me"),
  });
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function AccountLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();
  const { redirectToSignIn } = useClerk();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      redirectToSignIn({ redirectUrl: window.location.href });
    }
  }, [isLoaded, isSignedIn, redirectToSignIn]);

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-muted-foreground">
        Đang tải…
      </div>
    );
  }

  return <AccountLayoutInner>{children}</AccountLayoutInner>;
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { data: me } = useMe();

  const nav = [
    { href: "/account", label: "Tổng quan", icon: InboxIcon },
    { href: "/account/inboxes", label: "Inbox của tôi", icon: Mail },
    { href: "/account/api-keys", label: "API Keys", icon: Key, proOnly: true },
    { href: "/account/domains", label: "Domain riêng", icon: Globe, proOnly: true },
    { href: "/account/plan", label: "Gói cước", icon: Crown },
  ];

  return (
    <>
      <div className="h-16 flex items-center px-6 border-b">
        <span className="font-bold text-lg flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" /> Tài khoản
        </span>
      </div>
      <div className="px-4 py-3 border-b text-sm">
        <div className="font-medium truncate" data-testid="account-email">
          {user?.primaryEmailAddress?.emailAddress ?? user?.username}
        </div>
        <div className="mt-1 flex items-center gap-2">
          {me?.plan === "pro" ? (
            <Badge
              className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
              data-testid="badge-plan"
            >
              Pro
            </Badge>
          ) : (
            <Badge variant="secondary" data-testid="badge-plan">Free</Badge>
          )}
          {me?.role === "admin" && <Badge variant="outline">Admin</Badge>}
        </div>
      </div>
      <div className="p-4 flex-1 overflow-y-auto">
        <nav className="space-y-1">
          {nav.map((item) => {
            const active =
              location === item.href ||
              (item.href !== "/account" && location.startsWith(item.href));
            const Icon = item.icon;
            const locked = item.proOnly && me?.plan !== "pro";
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`nav-${item.href.replace(/\W/g, "-")}`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
                {locked && (
                  <span className="text-[10px] uppercase tracking-wider opacity-60">Pro</span>
                )}
              </Link>
            );
          })}
          {me?.role === "admin" && (
            <Link
              href="/admin"
              onClick={onNavigate}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <Crown className="h-4 w-4" /> Admin Console
            </Link>
          )}
        </nav>
      </div>
      <div className="p-4 border-t flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            onClick={onNavigate}
            className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Về trang chủ
          </Link>
          <ThemeToggle />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => signOut({ redirectUrl: basePath || "/" })}
          data-testid="button-signout"
        >
          <LogOut className="h-4 w-4 mr-2" /> Đăng xuất
        </Button>
      </div>
    </>
  );
}

function AccountLayoutInner({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-muted/20 text-foreground">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 h-14 border-b bg-background/95 backdrop-blur flex items-center gap-3 px-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Mở menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 flex flex-col">
            <SheetTitle className="sr-only">Menu tài khoản</SheetTitle>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="font-bold text-base flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" /> Tài khoản
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
