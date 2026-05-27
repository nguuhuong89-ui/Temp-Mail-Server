import { AccountLayout, useMe } from "@/components/layout/account-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { User, Mail, Key, Globe, Inbox, Trash2, Save, AlertTriangle, Download } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

type Usage = { inboxCount: number; emailCount: number; domainCount: number; apiKeyCount: number };

export default function AccountProfile() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: me } = useMe();

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const { data: usage } = useQuery<Usage>({
    queryKey: ["/account/usage"],
    queryFn: () => apiFetch<Usage>("/api/account/usage"),
  });

  useEffect(() => {
    if (me) {
      setDisplayName((me as Record<string, unknown>).displayName as string ?? "");
      setAvatarUrl((me as Record<string, unknown>).avatarUrl as string ?? "");
    }
  }, [me]);

  const updateProfile = useMutation({
    mutationFn: () =>
      apiFetch("/api/account/me", {
        method: "PATCH",
        body: JSON.stringify({ displayName, avatarUrl }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/account/me"] });
      toast({ title: t("profile.saved") });
    },
    onError: (e: Error) => toast({ title: t("profile.saveFailed"), description: e.message, variant: "destructive" }),
  });

  const deleteAccount = useMutation({
    mutationFn: () => apiFetch("/api/account/me", { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: t("profile.deleteSuccess") });
      setDeleteOpen(false);
      window.location.href = "/";
    },
    onError: (e: Error) => toast({ title: t("profile.deleteFailed"), description: e.message, variant: "destructive" }),
  });

  const usageStats = [
    { label: t("profile.usageInboxes"), value: usage?.inboxCount ?? 0, icon: Inbox },
    { label: t("profile.usageEmails"), value: usage?.emailCount ?? 0, icon: Mail },
    { label: t("profile.usageDomains"), value: usage?.domainCount ?? 0, icon: Globe },
    { label: t("profile.usageApiKeys"), value: usage?.apiKeyCount ?? 0, icon: Key },
  ];

  return (
    <AccountLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("profile.title")}</h1>
          <p className="text-muted-foreground">{t("profile.subtitle")}</p>
        </div>

        {/* Profile Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" /> {t("profile.info")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("profile.userId")}</Label>
              <Input value={me?.id ?? ""} disabled className="bg-muted font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <Label>{t("profile.displayName")}</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("profile.displayNamePlaceholder")}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("profile.avatarUrl")}</Label>
              <Input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                maxLength={500}
              />
            </div>
            <Button
              onClick={() => updateProfile.mutate()}
              disabled={updateProfile.isPending}
              className="gap-2"
            >
              <Save className="h-4 w-4" /> {t("profile.save")}
            </Button>
          </CardContent>
        </Card>

        {/* Usage */}
        <Card>
          <CardHeader>
            <CardTitle>{t("profile.usageTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
              {usageStats.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="text-center p-3 rounded-lg bg-muted/50">
                    <Icon className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                    <div className="text-2xl font-bold">{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        {/* Data Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" /> {t("profile.exportTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">{t("profile.exportDesc")}</p>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                window.open(
                  `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/account/export`,
                  "_blank",
                );
              }}
            >
              <Download className="h-4 w-4" /> {t("profile.exportButton")}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-red-300 dark:border-red-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" /> {t("profile.dangerZone")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">{t("profile.deleteWarning")}</p>
            <Button
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" /> {t("profile.deleteAccount")}
            </Button>
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" /> {t("profile.deleteConfirmTitle")}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{t("profile.deleteConfirmDesc")}</p>
            <div className="space-y-2">
              <Label>{t("profile.deleteConfirmLabel")}</Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                disabled={confirmText !== "DELETE" || deleteAccount.isPending}
                onClick={() => deleteAccount.mutate()}
              >
                {t("profile.deleteAccount")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AccountLayout>
  );
}
