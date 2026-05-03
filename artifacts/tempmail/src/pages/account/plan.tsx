import { AccountLayout, useMe } from "@/components/layout/account-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Crown, Mail } from "lucide-react";

const tiers = [
  {
    name: "Free",
    plan: "free" as const,
    price: "0₫",
    desc: "Cho người dùng cá nhân",
    features: [
      { ok: true, text: "Tạo & dùng inbox không giới hạn" },
      { ok: true, text: "Lưu lịch sử inbox khi đăng nhập" },
      { ok: true, text: "Webhook & QR share" },
      { ok: false, text: "Truy cập API cho AI agent" },
      { ok: false, text: "Thêm domain riêng" },
    ],
  },
  {
    name: "Pro",
    plan: "pro" as const,
    price: "Liên hệ",
    desc: "Cho developer và doanh nghiệp",
    features: [
      { ok: true, text: "Mọi tính năng của Free" },
      { ok: true, text: "API REST đầy đủ cho AI agent" },
      { ok: true, text: "Tạo & quản lý API key" },
      { ok: true, text: "Thêm domain riêng (verify DNS)" },
      { ok: true, text: "Webhook per-domain" },
    ],
    highlight: true,
  },
];

export default function AccountPlan() {
  const { data: me } = useMe();

  return (
    <AccountLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gói cước</h1>
          <p className="text-muted-foreground">
            Bạn đang dùng gói: <Badge className="ml-1">{me?.plan === "pro" ? "Pro" : "Free"}</Badge>
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {tiers.map((t) => {
            const isCurrent = me?.plan === t.plan;
            return (
              <Card key={t.plan} className={t.highlight ? "border-amber-400 dark:border-amber-700" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-2xl">
                      {t.highlight ? <Crown className="h-6 w-6 text-amber-500" /> : <Mail className="h-6 w-6 text-primary" />} {t.name}
                    </CardTitle>
                    {isCurrent && <Badge variant="secondary">Đang dùng</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{t.desc}</p>
                  <div className="text-3xl font-bold pt-2">{t.price}</div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {t.features.map((f, i) => (
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
              <p className="font-medium text-foreground mb-1">Muốn nâng cấp lên Pro?</p>
              <p>Liên hệ admin để được kích hoạt gói Pro cho tài khoản <span className="font-mono">{me?.email}</span>.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AccountLayout>
  );
}
