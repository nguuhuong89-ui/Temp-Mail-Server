import { useState } from "react";
import { PublicLayout } from "@/components/layout/public-layout";
import { Mail, Download, Copy, Check } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

function downloadCodePdf(code: string) {
  const html = `
    <html><head><title>TempMail Access Code</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 60px; text-align: center; }
      h1 { color: #7c3aed; margin-bottom: 8px; }
      .code { font-family: monospace; font-size: 32px; letter-spacing: 2px; padding: 20px; background: #f3f4f6; border-radius: 12px; margin: 24px 0; }
      .warning { color: #dc2626; font-weight: bold; margin-top: 24px; }
      .info { color: #6b7280; margin-top: 12px; font-size: 14px; }
    </style></head><body>
    <h1>TempMail Console</h1>
    <p>Your Access Code</p>
    <div class="code">${code}</div>
    <p class="warning">Keep this code safe! It is your only way to log in.</p>
    <p class="info">If you lose this code, you will lose access to your account permanently.</p>
    <p class="info">Generated: ${new Date().toISOString()}</p>
    </body></html>
  `;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tempmail-code-${Date.now()}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SignUpPage() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const [, setLocation] = useLocation();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleRegister = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await register();
      setCode(result.code);
    } catch (err) {
      setError((err as Error).message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (code) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-4 py-12">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl shadow-black/40 p-6 space-y-5">
            <div className="text-center">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-xl shadow-green-500/30 mb-4">
                <Check className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-xl font-bold">{t("signUp.successTitle")}</h1>
              <p className="text-sm text-muted-foreground mt-1">{t("signUp.successDesc")}</p>
            </div>

            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground mb-2">{t("signUp.yourCode")}</p>
              <p className="font-mono text-2xl tracking-wider font-bold text-violet-600 dark:text-violet-400">
                {code}
              </p>
            </div>

            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3">
              <p className="text-red-700 dark:text-red-300 text-sm font-medium text-center">
                {t("signUp.warningLoseCode")}
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? t("signUp.copied") : t("signUp.copyCode")}
              </Button>
              <Button variant="outline" className="flex-1 gap-2" onClick={() => downloadCodePdf(code)}>
                <Download className="h-4 w-4" /> {t("signUp.downloadCode")}
              </Button>
            </div>

            <Button
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500"
              onClick={() => setLocation("/account")}
            >
              {t("signUp.goToAccount")}
            </Button>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-4 py-12">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-xl shadow-violet-500/30 mb-4">
            <Mail className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">{t("signUp.title")}</h1>
          <p className="text-white/50 text-sm mt-1">
            {t("signUp.hasAccount")}{" "}
            <Link href="/sign-in" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
              {t("signUp.signInNow")}
            </Link>
          </p>
        </div>

        <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl shadow-black/40 p-6 space-y-4">
          <p className="text-sm text-muted-foreground">{t("signUp.explanation")}</p>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button
            onClick={handleRegister}
            disabled={loading}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/20 font-semibold"
          >
            {loading ? t("common.loading") : t("signUp.createAccount")}
          </Button>
        </div>
      </div>
    </PublicLayout>
  );
}
