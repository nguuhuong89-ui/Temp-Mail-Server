import { useState } from "react";
import { PublicLayout } from "@/components/layout/public-layout";
import { Mail } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignInPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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
          <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl shadow-black/40 p-6 space-y-4">
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
        </div>
      </div>
    </PublicLayout>
  );
}
