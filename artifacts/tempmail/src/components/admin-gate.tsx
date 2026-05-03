import { useEffect, useState, useSyncExternalStore } from "react";
import {
  fetchAuthStatus,
  getAdminToken,
  installAdminTokenFetcher,
  loginWithToken,
  setAdminToken,
  subscribeAdminToken,
} from "@/lib/admin-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

installAdminTokenFetcher();

export function useAdminToken(): string | null {
  return useSyncExternalStore(
    subscribeAdminToken,
    getAdminToken,
    () => null,
  );
}

export function AdminGate({ children }: { children: React.ReactNode }) {
  const token = useAdminToken();
  const [authRequired, setAuthRequired] = useState<boolean | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAuthStatus().then((s) => setAuthRequired(s.required));
  }, []);

  if (authRequired === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (authRequired && !token) {
    const submit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!tokenInput.trim()) return;
      setSubmitting(true);
      const ok = await loginWithToken(tokenInput.trim());
      setSubmitting(false);
      if (!ok) {
        toast({
          title: "Invalid token",
          description: "The admin token you entered was rejected.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Welcome back", description: "Admin session started." });
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/40 p-4">
        <form
          onSubmit={submit}
          className="w-full max-w-sm bg-card border rounded-xl p-8 shadow-lg space-y-5"
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Lock className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold">Admin sign-in</h1>
            <p className="text-sm text-muted-foreground">
              Enter the admin token configured via <code className="font-mono">ADMIN_TOKEN</code>.
            </p>
          </div>
          <Input
            type="password"
            placeholder="Admin token"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            autoFocus
          />
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Verifying…" : "Sign in"}
          </Button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}

export function AdminLogoutButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setAdminToken(null)}
      className="text-muted-foreground hover:text-foreground gap-2"
    >
      <LogOut className="h-4 w-4" /> Sign out
    </Button>
  );
}
