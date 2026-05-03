import { Link } from "wouter";
import { Mail } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/30">
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container max-w-5xl mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight transition-colors hover:text-primary">
            <Mail className="h-6 w-6 text-primary" />
            <span>TempMail</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/admin" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Operator
            </Link>
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
