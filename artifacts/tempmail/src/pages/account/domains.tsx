import { AccountLayout, useMe } from "@/components/layout/account-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Globe, Plus, RefreshCw, Trash2, CheckCircle2, AlertCircle, Crown, Copy } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

type Domain = {
  id: number;
  name: string;
  status: string;
  verifiedAt: string | null;
  mxHost: string;
  createdAt: string;
};

type DomainsResponse = {
  domains: Domain[];
  serverIp: string | null;
  mailDomain: string;
};

function CopyButton({ value, onCopy }: { value: string; onCopy: (v: string) => void }) {
  return (
    <button
      className="ml-1 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-muted-foreground hover:text-foreground transition-colors"
      onClick={() => onCopy(value)}
      title="Copy"
    >
      <Copy className="h-3 w-3" />
    </button>
  );
}

function DnsRecordRow({ type, host, value, priority, onCopy }: { type: string; host: string; value: string; priority?: string; onCopy: (v: string) => void }) {
  return (
    <div className="grid grid-cols-[60px_80px_1fr_70px] gap-2 px-4 py-2.5 text-xs items-center border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span className="font-mono font-bold text-violet-600 dark:text-violet-400">{type}</span>
      <span className="font-mono text-muted-foreground">{host}</span>
      <div className="flex items-center gap-1 min-w-0">
        <code className="font-mono text-foreground truncate">{value}</code>
        <CopyButton value={value} onCopy={onCopy} />
      </div>
      <span className="font-mono text-muted-foreground text-right">{priority ?? "—"}</span>
    </div>
  );
}

export default function AccountDomains() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  if (me && me.plan !== "pro") {
    return (
      <AccountLayout>
        <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Crown className="h-5 w-5 text-amber-600" /> {t("domains.proRequired")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/account/plan"><Button>{t("domains.viewPlans")}</Button></Link>
          </CardContent>
        </Card>
      </AccountLayout>
    );
  }
  return <AccountLayout><DomainsInner /></AccountLayout>;
}

function DomainsInner() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const { data: resp, isLoading } = useQuery<DomainsResponse>({
    queryKey: ["/account/domains"],
    queryFn: async () => {
      const raw = await apiFetch<DomainsResponse | Domain[]>("/api/account/domains");
      if (Array.isArray(raw)) return { domains: raw, serverIp: null, mailDomain: "" };
      return raw;
    },
  });
  const data = resp?.domains;
  const serverIp = resp?.serverIp;
  const mailDomain = resp?.mailDomain;
  const refresh = () => qc.invalidateQueries({ queryKey: ["/account/domains"] });

  const add = useMutation({
    mutationFn: (n: string) =>
      apiFetch<Domain>("/api/account/domains", { method: "POST", body: JSON.stringify({ name: n }) }),
    onSuccess: () => { setName(""); setOpen(false); refresh(); toast({ title: t("domains.toastAdded") }); },
    onError: (e: Error) => toast({ title: t("domains.toastError"), description: e.message, variant: "destructive" }),
  });

  const verify = useMutation({
    mutationFn: (id: number) => apiFetch<{ ok: boolean }>(`/api/account/domains/${id}/verify`, { method: "POST" }),
    onSuccess: () => { refresh(); toast({ title: t("domains.toastVerified") }); },
    onError: (e: Error) => toast({ title: t("domains.toastVerifyFailed"), description: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/account/domains/${id}`, { method: "DELETE" }),
    onSuccess: () => { refresh(); toast({ title: t("domains.toastDeleted") }); },
  });

  const copy = (val: string) => { navigator.clipboard.writeText(val); toast({ title: t("domains.toastCopied") }); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("domains.title")}</h1>
          <p className="text-muted-foreground">{t("domains.subtitle")}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-domain"><Plus className="h-4 w-4 mr-2" /> {t("domains.addBtn")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("domains.addTitle")}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>{t("domains.domainName")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. mail.example.com" data-testid="input-domain-name" />
              </div>
              <Button className="w-full" onClick={() => add.mutate(name.trim().toLowerCase())} disabled={add.isPending || !name.trim()}>
                {add.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : t("domains.addBtn")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-12"><RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
      ) : !data?.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Globe className="h-8 w-8 mx-auto mb-2 opacity-40" />
          {t("domains.noDomains")}
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {data.map((d) => (
            <Card key={d.id} data-testid={`card-domain-${d.id}`}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg font-mono">{d.name}</CardTitle>
                  {d.verifiedAt ? (
                    <Badge className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" /> {t("domains.verified")}</Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300"><AlertCircle className="h-3 w-3 mr-1" /> {t("domains.pending")}</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {!d.verifiedAt && (
                    <Button variant="outline" size="sm" onClick={() => verify.mutate(d.id)} disabled={verify.isPending} data-testid={`button-verify-${d.id}`}>
                      {verify.isPending ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />} {t("domains.verifyNow")}
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => del.mutate(d.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              {!d.verifiedAt && (
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <p className="text-muted-foreground mb-2">{t("domains.dnsFullInstruction")}</p>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <div className="grid grid-cols-[60px_80px_1fr_70px] gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-slate-200 dark:border-slate-700">
                        <span>{t("domains.dnsType")}</span><span>Host</span><span>{t("domains.dnsValue")}</span><span className="text-right">{t("domains.dnsPriority")}</span>
                      </div>
                      {serverIp && (
                        <DnsRecordRow type="A" host="mail" value={serverIp} onCopy={copy} />
                      )}
                      <DnsRecordRow type="MX" host="@" value={d.mxHost || mailDomain || "mail.vnsi.app"} priority="10" onCopy={copy} />
                      <DnsRecordRow type="TXT" host="@" value="v=spf1 mx ~all" onCopy={copy} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{t("domains.dnsPropagation")}</p>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
