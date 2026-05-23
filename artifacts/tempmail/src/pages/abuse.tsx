import { PublicLayout } from "@/components/layout/public-layout";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function AbusePage() {
  const { t } = useTranslation();
  return (
    <PublicLayout>
      <div className="container max-w-3xl mx-auto px-4 py-10 sm:py-16">
        <div className="flex items-start gap-3 mb-6">
          <AlertTriangle className="h-7 w-7 text-amber-500 shrink-0 mt-1" />
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{t("abuse.title")}</h1>
            <p className="text-muted-foreground mt-1">{t("abuse.subtitle")}</p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 sm:p-6 space-y-4">
          <h2 className="font-semibold text-lg">{t("abuse.infoTitle")}</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            <li>{t("abuse.info1")} <code className="font-mono text-foreground">abc@tempmail.local</code>).</li>
            <li>{t("abuse.info2")}</li>
            <li>{t("abuse.info3")}</li>
            <li>{t("abuse.info4")}</li>
          </ul>

          <div className="pt-2 border-t">
            <h2 className="font-semibold mb-2">{t("abuse.sendTitle")}</h2>
            <p className="text-sm">
              {t("abuse.emailLabel")}{" "}
              <a href="mailto:abuse@tempmail.local" className="font-mono text-primary hover:underline">
                abuse@tempmail.local
              </a>
            </p>
            <p className="text-xs text-muted-foreground mt-2">{t("abuse.processingTime")}</p>
          </div>
        </div>

        <div className="mt-6 text-sm text-muted-foreground">{t("abuse.disclaimer")}</div>
      </div>
    </PublicLayout>
  );
}
