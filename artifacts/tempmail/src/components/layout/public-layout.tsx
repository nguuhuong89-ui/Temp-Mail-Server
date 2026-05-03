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
        <div className="container max-w-5xl mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight transition-colors hover:text-primary">
            <Mail className="h-6 w-6 text-primary" />
            <span>TempMail</span>
          </Link>
          <nav className="flex items-center gap-3">
            <Show when="signed-in">
              <Link href="/account">
                <Button variant="ghost" size="sm" data-testid="link-account">
                  <UserIcon className="h-4 w-4 mr-1" /> Tài khoản
                </Button>
              </Link>
              <UserButton
                userProfileMode="navigation"
                userProfileUrl={`${basePath}/account`}
              />
            </Show>
            <Show when="signed-out">
              <Link href="/sign-in">
                <Button variant="ghost" size="sm" data-testid="link-signin">
                  <LogIn className="h-4 w-4 mr-1" /> Đăng nhập
                </Button>
              </Link>
              <Link href="/sign-up">
                <Button size="sm" data-testid="link-signup">Đăng ký</Button>
              </Link>
            </Show>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
      <footer className="border-t py-6 md:py-0 border-border/40">
        <div className="container max-w-5xl mx-auto flex flex-col md:h-14 items-center justify-between gap-4 md:flex-row px-4">
          <p className="text-sm leading-loose text-muted-foreground">
            Built with speed and confidence.
          </p>
        </div>
      </footer>
    </div>
  );
}
