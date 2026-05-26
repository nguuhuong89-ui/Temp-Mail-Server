import { AccountLayout } from "@/components/layout/account-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Webhook, Plus, Trash2, Copy, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "react-i18next";

type WebhookItem = {
  id: number;
  url: string;
  events: string[];
  isActive: boolean;
  failCount: number;
  lastTriggeredAt: string | null;
  createdAt: string;
  secret?: string;
};

const EVENTS = [
  { value: "new_email", label: "New Email Received" },
  { value: "inbox_expired", label: "Inbox Expired" },
  { value: "domain_removed", label: "Domain Removed" },
];

export default function AccountWebhooks() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>(["new_email"]);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const { data: webhooks, isLoading } = useQuery<WebhookItem[]>({
    queryKey: ["/account/webhooks"],
    queryFn: () => apiFetch<WebhookItem[]>("/api/account/webhooks"),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch<WebhookItem>("/api/account/webhooks", {
        method: "POST",
        body: JSON.stringify({ url: newUrl, events: newEvents }),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/account/webhooks"] });
      setNewSecret(data.secret ?? null);
      setNewUrl("");
      setNewEvents(["new_email"]);
      toast({ title: t("webhooks.created") });
    },
    onError: (e: Error) => toast({ title: t("webhooks.createFailed"), description: e.message, variant: "destructive" }),
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiFetch(`/api/account/webhooks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/account/webhooks"] }),
  });

  const remove = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/account/webhooks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/account/webhooks"] });
      toast({ title: t("webhooks.deleted") });
    },
  });

  return (
    <AccountLayout>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("webhooks.title")}</h1>
            <p className="text-muted-foreground">{t("webhooks.subtitle")}</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> {t("webhooks.add")}
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">{t("common.loading")}</p>
        ) : !webhooks?.length ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Webhook className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">{t("webhooks.empty")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {webhooks.map((wh) => (
              <Card key={wh.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono truncate">{wh.url}</code>
                        {!wh.isActive && <Badge variant="secondary">Paused</Badge>}
                        {wh.failCount > 0 && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="h-3 w-3" /> {wh.failCount} fails
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {wh.events.map((e) => (
                          <Badge key={e} variant="outline" className="text-xs">{e}</Badge>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {wh.lastTriggeredAt
                          ? `Last triggered ${formatDistanceToNow(new Date(wh.lastTriggeredAt), { addSuffix: true })}`
                          : "Never triggered"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={wh.isActive}
                        onCheckedChange={(v) => toggle.mutate({ id: wh.id, isActive: v })}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                        onClick={() => remove.mutate(wh.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Dialog */}
        <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setNewSecret(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{newSecret ? t("webhooks.secretTitle") : t("webhooks.addTitle")}</DialogTitle>
            </DialogHeader>
            {newSecret ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{t("webhooks.secretDesc")}</p>
                <div className="flex gap-2">
                  <Input value={newSecret} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="sm" onClick={() => {
                    navigator.clipboard.writeText(newSecret);
                    toast({ title: t("webhooks.secretCopied") });
                  }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <DialogFooter>
                  <Button onClick={() => { setCreateOpen(false); setNewSecret(null); }}>{t("common.close")}</Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("webhooks.urlLabel")}</Label>
                  <Input
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://example.com/webhook"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("webhooks.eventsLabel")}</Label>
                  <div className="space-y-2">
                    {EVENTS.map((ev) => (
                      <label key={ev.value} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={newEvents.includes(ev.value)}
                          onChange={(e) => {
                            if (e.target.checked) setNewEvents([...newEvents, ev.value]);
                            else setNewEvents(newEvents.filter((x) => x !== ev.value));
                          }}
                          className="rounded"
                        />
                        {ev.label}
                      </label>
                    ))}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("common.cancel")}</Button>
                  <Button
                    onClick={() => create.mutate()}
                    disabled={!newUrl.startsWith("https://") || newEvents.length === 0 || create.isPending}
                  >
                    {t("webhooks.create")}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AccountLayout>
  );
}
