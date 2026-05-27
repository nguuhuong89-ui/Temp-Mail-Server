import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth, useUser } from "@/lib/auth-context";
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
  User,
  Webhook,
  BookmarkCheck,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useTranslation } from "react-i18next";

type Me = { id: string; plan: "free" | "pro"; role: "user" | "admin"; email: string | null; displayName: string | null };

export function useMe() {
  return useQuery<Me>({
    queryKey: ["/account/me"],
    queryFn: () => apiFetch<Me>("/api/account/me"),
  });
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function AccountLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setLocation("/sign-in");
    }
  }, [isLoaded, isSignedIn, setLocation]);

  const { t } = useTranslation();
  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  return <AccountLayoutInner>{children}</AccountLayoutInner>;
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { data: me } = useMe();

  const nav = [
    { href: "/account", label: t("accountLayout.overview"), icon: InboxIcon },
    { href: "/account/profile", label: t("accountLayout.profile"), icon: User },
    { href: "/account/inboxes", label: t("account.inboxes"), icon: Mail },
    { href: "/account/saved-inboxes", label: t("account.savedInboxes"), icon: BookmarkCheck },
    { href: "/account/api-keys", label: "API Keys", icon: Key, proOnly: true },
    { href: "/account/domains", label: t("account.domains"), icon: Globe, proOnly: true },
    { href: "/account/webhooks", label: t("accountLayout.webhooks"), icon: Webhook, proOnly: true },
    { href: "/account/plan", label: t("account.plan"), icon: Crown },
  ];

  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <>
      <div className="h-16 flex items-center px-6 border-b">
        <span className="font-bold text-lg flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" /> {t("account.title")}
        </span>
      </div>
      <div className="px-4 py-3 border-b text-sm">
        <div className="font-medium truncate" data-testid="account-email">
          {user?.displayName || user?.id?.slice(0, 16)}
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
              <Crown className="h-4 w-4" /> {t("accountLayout.adminConsole")}
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
            <ArrowLeft className="h-4 w-4" /> {t("accountLayout.backHome")}
          </Link>
          <ThemeToggle />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          data-testid="button-signout"
        >
          <LogOut className="h-4 w-4 mr-2" /> {t("accountLayout.signOut")}
        </Button>
      </div>
    </>
  );
}

function AccountLayoutInner({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-muted/20 text-foreground">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 h-14 border-b bg-background/95 backdrop-blur flex items-center gap-3 px-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("accountLayout.openMenu")}>
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 flex flex-col">
            <SheetTitle className="sr-only">{t("accountLayout.menuTitle")}</SheetTitle>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="font-bold text-base flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" /> {t("account.title")}
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
