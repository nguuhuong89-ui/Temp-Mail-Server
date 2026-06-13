import { useState } from "react";
import { PublicLayout } from "@/components/layout/public-layout";
import { Mail, KeyRound } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Tab = "code" | "email";

export default function SignInPage() {
  const { t } = useTranslation();
  const { login, loginWithEmail } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("code");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needs2FA, setNeeds2FA] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(code);
      setLocation("/account");
    } catch (err) {
      setError((err as Error).message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await loginWithEmail(email, password, totpCode || undefined);
      if (result.requires2FA) {
        setNeeds2FA(true);
        setLoading(false);
        return;
      }
      setLocation("/account");
    } catch (err) {
      setError((err as Error).message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-4 py-12">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-xl shadow-violet-500/30 mb-4">
            <Mail className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">{t("signIn.title")}</h1>
          <p className="text-white/50 text-sm mt-1">
            {t("signIn.noAccount")}{" "}
            <Link href="/sign-up" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
              {t("signIn.signUpFree")}
            </Link>
          </p>
        </div>

        <div className="w-full max-w-md">
          {/* Tabs */}
          <div className="flex mb-4 rounded-xl overflow-hidden border border-white/10">
            <button
              onClick={() => { setTab("code"); setError(""); setNeeds2FA(false); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === "code" ? "bg-violet-600 text-white" : "bg-white/5 text-white/60 hover:text-white/80"}`}
            >
              <KeyRound className="h-3.5 w-3.5 inline mr-1.5" />
              {t("signIn.codeTab")}
            </button>
            <button
              onClick={() => { setTab("email"); setError(""); setNeeds2FA(false); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === "email" ? "bg-violet-600 text-white" : "bg-white/5 text-white/60 hover:text-white/80"}`}
            >
              <Mail className="h-3.5 w-3.5 inline mr-1.5" />
              {t("signIn.emailTab")}
            </button>
          </div>

          {tab === "code" ? (
            <form onSubmit={handleCodeSubmit} className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl shadow-black/40 p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
                  {t("signIn.codeLabel")}
                </label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="xxxx-xxxx-xxxx-xxxx-xxxx"
                  className="font-mono text-center text-lg tracking-wider"
                  autoFocus
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <Button
                type="submit"
                disabled={loading || code.replace(/[\s-]/g, "").length < 20}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/20 font-semibold"
              >
                {loading ? "..." : t("signIn.submit")}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleEmailSubmit} className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl shadow-black/40 p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
                  Email
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                  disabled={needs2FA}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
                  {t("signIn.passwordLabel")}
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  disabled={needs2FA}
                />
              </div>
              {needs2FA && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
                    {t("signIn.totpLabel")}
                  </label>
                  <Input
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="123456"
                    className="font-mono text-center text-lg tracking-wider"
                    autoFocus
                    maxLength={6}
                  />
                </div>
              )}
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <Button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/20 font-semibold"
              >
                {loading ? "..." : t("signIn.submit")}
              </Button>
            </form>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
