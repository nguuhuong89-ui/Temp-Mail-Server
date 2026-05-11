import { Link } from "wouter";
import { Mail, BookOpen, Globe, ShieldCheck, AlertTriangle, User as UserIcon, LogIn, MessageCircle } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { Show, UserButton } from "@clerk/react";
import { Button } from "@/components/ui/button";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-900 text-foreground selection:bg-primary/30">
      <header className="bg-white dark:bg-card border-b border-border/60 shadow-sm sticky top-0 z-50">
        <div className="container max-w-5xl mx-auto flex h-12 items-center justify-between gap-2 px-3 sm:px-4">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-1.5 font-bold text-lg tracking-tight hover:opacity-80 transition-opacity shrink-0"
          >
            <Mail className="h-5 w-5 text-primary" />
            <span>
              <span className="text-foreground">Temp</span>
              <span className="text-primary">host</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1 text-sm">
            <Link href="/admin/api-docs">
              <Button variant="ghost" size="sm" className="gap-1.5 h-8 px-2.5 text-xs">
                <BookOpen className="h-3.5 w-3.5" />
                API Docs
              </Button>
            </Link>
            <Show when="signed-in">
              <Link href="/account/domains">
                <Button variant="ghost" size="sm" className="gap-1.5 h-8 px-2.5 text-xs">
                  <Globe className="h-3.5 w-3.5" />
                  Add Custom Domain
                </Button>
              </Link>
            </Show>
            <Show when="signed-out">
              <Link href="/sign-in">
                <Button variant="ghost" size="sm" className="gap-1.5 h-8 px-2.5 text-xs">
                  <Globe className="h-3.5 w-3.5" />
                  Add Custom Domain
                </Button>
              </Link>
            </Show>
            <Link href="/acceptable-use">
              <Button variant="ghost" size="sm" className="gap-1.5 h-8 px-2.5 text-xs">
                <ShieldCheck className="h-3.5 w-3.5" />
                Acceptable Use
              </Button>
            </Link>
            <Link href="/abuse">
              <Button variant="ghost" size="sm" className="gap-1.5 h-8 px-2.5 text-xs">
                <AlertTriangle className="h-3.5 w-3.5" />
                Abuse
              </Button>
            </Link>
            <a href="mailto:contact@tempmail.local">
              <Button variant="ghost" size="sm" className="gap-1.5 h-8 px-2.5 text-xs">
                <MessageCircle className="h-3.5 w-3.5" />
                Contact
              </Button>
            </a>
          </nav>

          {/* Right: auth + theme */}
          <div className="flex items-center gap-1 shrink-0">
            <Show when="signed-in">
              <Link href="/account">
                <Button variant="ghost" size="sm" className="h-8 px-2 sm:px-3 text-xs" aria-label="Tài khoản">
                  <UserIcon className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">Tài khoản</span>
                </Button>
              </Link>
              <UserButton userProfileMode="navigation" userProfileUrl={`${basePath}/account`} />
            </Show>
            <Show when="signed-out">
              <Link href="/sign-in">
                <Button variant="ghost" size="sm" className="h-8 px-2 sm:px-3 text-xs" aria-label="Đăng nhập">
                  <LogIn className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">Đăng nhập</span>
                </Button>
              </Link>
              <Link href="/sign-up">
                <Button size="sm" className="h-8 px-2.5 text-xs">Đăng ký</Button>
              </Link>
            </Show>
            <ThemeToggle />
          </div>
        </div>

        {/* Mobile nav row */}
        <div className="md:hidden border-t bg-muted/30 flex overflow-x-auto gap-1 px-2 py-1 scrollbar-none">
          <Link href="/admin/api-docs">
            <Button variant="ghost" size="sm" className="gap-1 h-7 px-2 text-xs whitespace-nowrap">
              <BookOpen className="h-3 w-3" /> API Docs
            </Button>
          </Link>
          <Link href="/account/domains">
            <Button variant="ghost" size="sm" className="gap-1 h-7 px-2 text-xs whitespace-nowrap">
              <Globe className="h-3 w-3" /> Add Domain
            </Button>
          </Link>
          <Link href="/acceptable-use">
            <Button variant="ghost" size="sm" className="gap-1 h-7 px-2 text-xs whitespace-nowrap">
              <ShieldCheck className="h-3 w-3" /> Acceptable Use
            </Button>
          </Link>
          <Link href="/abuse">
            <Button variant="ghost" size="sm" className="gap-1 h-7 px-2 text-xs whitespace-nowrap">
              <AlertTriangle className="h-3 w-3" /> Abuse
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t py-4 bg-white dark:bg-card border-border/40">
        <div className="container max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 px-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} TempHost — receive-only temporary email service.</p>
          <nav className="flex items-center gap-4">
            <Link href="/acceptable-use" className="hover:text-foreground transition-colors">Chính sách sử dụng</Link>
            <Link href="/abuse" className="hover:text-foreground transition-colors">Báo cáo lạm dụng</Link>
            <a href="mailto:contact@tempmail.local" className="hover:text-foreground transition-colors">Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
