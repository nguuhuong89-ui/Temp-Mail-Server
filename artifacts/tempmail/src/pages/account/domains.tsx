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

  const { data, isLoading } = useQuery<Domain[]>({
    queryKey: ["/account/domains"],
    queryFn: () => apiFetch<Domain[]>("/api/account/domains"),
  });
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
                    <p className="text-muted-foreground mb-2">{t("domains.mxInstruction")}</p>
                    <div className="bg-muted rounded-lg p-3 space-y-2 font-mono text-xs">
                      <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center">
                        <span className="text-muted-foreground">{t("domains.dnsType")}</span>
                        <span>MX</span>
                        <span></span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center">
                        <span className="text-muted-foreground">{t("domains.dnsName")}</span>
                        <span>@ ({t("domains.orDomain", { domain: d.name })})</span>
                        <span></span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center">
                        <span className="text-muted-foreground">{t("domains.dnsPriority")}</span>
                        <span>10</span>
                        <span></span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center">
                        <span className="text-muted-foreground">{t("domains.dnsValue")}</span>
                        <span className="break-all" data-testid={`text-mx-${d.id}`}>{d.mxHost}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copy(d.mxHost)}><Copy className="h-3 w-3" /></Button>
                      </div>
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
