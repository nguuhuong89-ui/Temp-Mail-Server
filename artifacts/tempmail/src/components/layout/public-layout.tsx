import { Link } from "wouter";
import { Mail, User as UserIcon, LogIn } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { Show, UserButton } from "@clerk/react";
import { Button } from "@/components/ui/button";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/30">
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container max-w-5xl mx-auto flex h-14 sm:h-16 items-center justify-between gap-2 px-3 sm:px-4">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-lg sm:text-xl tracking-tight transition-colors hover:text-primary shrink-0"
          >
            <Mail className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <span>TempMail</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-3">
            <Show when="signed-in">
              <Link href="/account">
                {/* Icon-only on mobile, full label on sm+ */}
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid="link-account"
                  className="px-2 sm:px-3"
                  aria-label="Tài khoản"
                >
                  <UserIcon className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Tài khoản</span>
                </Button>
              </Link>
              <UserButton
                userProfileMode="navigation"
                userProfileUrl={`${basePath}/account`}
              />
            </Show>
            <Show when="signed-out">
              <Link href="/sign-in">
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid="link-signin"
                  className="px-2 sm:px-3"
                  aria-label="Đăng nhập"
                >
                  <LogIn className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Đăng nhập</span>
                </Button>
              </Link>
              <Link href="/sign-up">
                <Button size="sm" data-testid="link-signup" className="px-3">
                  Đăng ký
                </Button>
              </Link>
            </Show>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t py-6 border-border/40">
        <div className="container max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 px-4 text-sm text-muted-foreground">
          <p className="leading-loose">Built with speed and confidence.</p>
          <nav className="flex items-center gap-4">
            <Link href="/acceptable-use" className="hover:text-foreground transition-colors">
              Chính sách sử dụng
            </Link>
            <Link href="/abuse" className="hover:text-foreground transition-colors">
              Báo cáo lạm dụng
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
