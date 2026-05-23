import { AccountLayout, useMe } from "@/components/layout/account-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Crown, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function AccountPlan() {
  const { t } = useTranslation();
  const { data: me } = useMe();

  const tiers = [
    {
      name: "Free",
      plan: "free" as const,
      price: "0₫",
      desc: t("plan.freeTierDesc"),
      features: [
        { ok: true, text: t("plan.freeFeature1") },
        { ok: true, text: t("plan.freeFeature2") },
        { ok: true, text: t("plan.freeFeature3") },
        { ok: false, text: t("plan.freeFeature4") },
        { ok: false, text: t("plan.freeFeature5") },
      ],
    },
    {
      name: "Pro",
      plan: "pro" as const,
      price: t("plan.proPrice"),
      desc: t("plan.proTierDesc"),
      features: [
        { ok: true, text: t("plan.proFeature1") },
        { ok: true, text: t("plan.proFeature2") },
        { ok: true, text: t("plan.proFeature3") },
        { ok: true, text: t("plan.proFeature4") },
        { ok: true, text: t("plan.proFeature5") },
      ],
      highlight: true,
    },
  ];

  return (
    <AccountLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("plan.title")}</h1>
          <p className="text-muted-foreground">
            {t("plan.usingPlan")} <Badge className="ml-1">{me?.plan === "pro" ? "Pro" : "Free"}</Badge>
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {tiers.map((tier) => {
            const isCurrent = me?.plan === tier.plan;
            return (
              <Card key={tier.plan} className={tier.highlight ? "border-amber-400 dark:border-amber-700" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-2xl">
                      {tier.highlight ? <Crown className="h-6 w-6 text-amber-500" /> : <Mail className="h-6 w-6 text-primary" />} {tier.name}
                    </CardTitle>
                    {isCurrent && <Badge variant="secondary">{t("plan.current")}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{tier.desc}</p>
                  <div className="text-3xl font-bold pt-2">{tier.price}</div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {tier.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        {f.ok ? <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" /> : <X className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
                        <span className={f.ok ? "" : "text-muted-foreground"}>{f.text}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
        {me?.plan !== "pro" && (
          <Card className="bg-muted/30">
            <CardContent className="py-6 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">{t("plan.upgradeTitle")}</p>
              <p>{t("plan.upgradeDesc", { email: me?.email ?? "" })}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AccountLayout>
  );
}
