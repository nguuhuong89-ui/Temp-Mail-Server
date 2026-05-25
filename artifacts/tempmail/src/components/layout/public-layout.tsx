import { Link } from "wouter";
import { Mail, BookOpen, ShieldCheck, AlertTriangle, User as UserIcon, LogIn, MessageCircle } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { Show, UserButton } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useTranslation } from "react-i18next";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950 text-foreground selection:bg-violet-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/30 backdrop-blur-md">
        <div className="container max-w-5xl mx-auto flex h-12 items-center justify-between gap-2 px-3 sm:px-4">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 font-extrabold text-lg tracking-tight hover:opacity-90 transition-opacity shrink-0"
          >
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Mail className="h-4 w-4 text-white" />
            </div>
            <span className="text-white">
              Temp<span className="text-violet-400">Mail</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5 text-sm">
            {[
              { href: "/docs", icon: BookOpen, label: t("nav.apiDocs") },
              { href: "/acceptable-use", icon: ShieldCheck, label: t("nav.acceptableUse") },
              { href: "/abuse", icon: AlertTriangle, label: t("nav.abuse") },
            ].map(({ href, icon: Icon, label }) => (
              <Link key={href} href={href}>
                <Button variant="ghost" size="sm" className="gap-1.5 h-8 px-2.5 text-xs text-white/70 hover:text-white hover:bg-white/10">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Button>
              </Link>
            ))}
            <Show when="signed-in">
              <Link href="/account/domains">
                <Button variant="ghost" size="sm" className="gap-1.5 h-8 px-2.5 text-xs text-white/70 hover:text-white hover:bg-white/10">
                  {t("nav.addCustomDomain")}
                </Button>
              </Link>
            </Show>
            <Show when="signed-out">
              <Link href="/sign-in">
                <Button variant="ghost" size="sm" className="gap-1.5 h-8 px-2.5 text-xs text-white/70 hover:text-white hover:bg-white/10">
                  {t("nav.addCustomDomain")}
                </Button>
              </Link>
            </Show>
            <a href="mailto:contact@tempmail.local">
              <Button variant="ghost" size="sm" className="gap-1.5 h-8 px-2.5 text-xs text-white/70 hover:text-white hover:bg-white/10">
                <MessageCircle className="h-3.5 w-3.5" /> {t("nav.contact")}
              </Button>
            </a>
          </nav>

          {/* Right: language + auth */}
          <div className="flex items-center gap-1 shrink-0">
            <LanguageSwitcher />
            <Show when="signed-in">
              <Link href="/account">
                <Button variant="ghost" size="sm" className="h-8 px-2 sm:px-3 text-xs text-white/80 hover:text-white hover:bg-white/10">
                  <UserIcon className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">{t("nav.account")}</span>
                </Button>
              </Link>
              <UserButton userProfileMode="navigation" userProfileUrl={`${basePath}/account`} />
            </Show>
            <Show when="signed-out">
              <Link href="/sign-in">
                <Button variant="ghost" size="sm" className="h-8 px-2 sm:px-3 text-xs text-white/80 hover:text-white hover:bg-white/10">
                  <LogIn className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">{t("nav.signIn")}</span>
                </Button>
              </Link>
              <Link href="/sign-up">
                <Button size="sm" className="h-8 px-3 text-xs bg-violet-600 hover:bg-violet-500 border-0 text-white shadow-lg shadow-violet-500/30">
                  {t("nav.signUp")}
                </Button>
              </Link>
            </Show>
            <ThemeToggle />
          </div>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden border-t border-white/10 flex overflow-x-auto gap-1 px-2 py-1.5">
          <Link href="/docs">
            <Button variant="ghost" size="sm" className="gap-1 h-7 px-2 text-xs whitespace-nowrap text-white/70 hover:text-white hover:bg-white/10">
              <BookOpen className="h-3 w-3" /> {t("nav.apiDocs")}
            </Button>
          </Link>
          <Link href="/account/domains">
            <Button variant="ghost" size="sm" className="gap-1 h-7 px-2 text-xs whitespace-nowrap text-white/70 hover:text-white hover:bg-white/10">
              {t("nav.addCustomDomain")}
            </Button>
          </Link>
          <Link href="/acceptable-use">
            <Button variant="ghost" size="sm" className="gap-1 h-7 px-2 text-xs whitespace-nowrap text-white/70 hover:text-white hover:bg-white/10">
              <ShieldCheck className="h-3 w-3" /> {t("nav.acceptableUse")}
            </Button>
          </Link>
          <Link href="/abuse">
            <Button variant="ghost" size="sm" className="gap-1 h-7 px-2 text-xs whitespace-nowrap text-white/70 hover:text-white hover:bg-white/10">
              <AlertTriangle className="h-3 w-3" /> {t("nav.abuse")}
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-white/10 py-4 bg-black/20 backdrop-blur-sm">
        <div className="container max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 px-4 text-xs text-white/50">
          <p>© {new Date().getFullYear()} TempMail — {t("footer.tagline")}</p>
          <nav className="flex items-center gap-4">
            <Link href="/docs" className="hover:text-white/80 transition-colors">{t("nav.apiDocs")}</Link>
            <Link href="/acceptable-use" className="hover:text-white/80 transition-colors">{t("nav.policyLink")}</Link>
            <Link href="/abuse" className="hover:text-white/80 transition-colors">{t("nav.abuseLink")}</Link>
            <a href="mailto:contact@tempmail.local" className="hover:text-white/80 transition-colors">{t("nav.contact")}</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
