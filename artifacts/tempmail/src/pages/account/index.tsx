import { AccountLayout, useMe } from "@/components/layout/account-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { Mail, Key, Globe, Crown, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

type AccountInbox = { id: number; address: string; emailCount: number; expiresAt: string };

export default function AccountHome() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const { data: inboxes } = useQuery<AccountInbox[]>({
    queryKey: ["/account/inboxes"],
    queryFn: () => apiFetch<AccountInbox[]>("/api/account/inboxes"),
  });
  const { data: keys } = useQuery<unknown[]>({
    queryKey: ["/account/api-keys-summary"],
    queryFn: () =>
      me?.plan === "pro" ? apiFetch<unknown[]>("/api/account/api-keys") : Promise.resolve([]),
    enabled: me?.plan === "pro",
  });

  const stats = [
    { label: t("accountHome.statInboxes"), value: inboxes?.length ?? 0, icon: Mail, href: "/account/inboxes" },
    { label: t("accountHome.statApiKey"), value: me?.plan === "pro" ? (keys?.length ?? 0) : "—", icon: Key, href: "/account/api-keys" },
    { label: t("accountHome.statPlan"), value: me?.plan === "pro" ? "Pro" : "Free", icon: Crown, href: "/account/plan" },
    { label: t("accountHome.statDomains"), value: me?.plan === "pro" ? t("accountHome.statManage") : "—", icon: Globe, href: "/account/domains" },
  ];

  return (
    <AccountLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("accountHome.greeting")}</h1>
          <p className="text-muted-foreground">{t("accountHome.subtitle")}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Link key={s.label} href={s.href}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                  <s.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{s.value}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {me?.plan !== "pro" && (
          <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Crown className="h-5 w-5 text-amber-600" /> {t("accountHome.upgradeTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("accountHome.upgradeDesc")}</p>
              <Link href="/account/plan" className="text-sm text-primary font-medium inline-flex items-center gap-1">
                {t("accountHome.upgradeLink")} <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </AccountLayout>
  );
}
