import { AdminLayout } from "@/components/layout/admin-layout";
import {
  useListDomains,
  useCreateDomain,
  useUpdateDomain,
  useDeleteDomain,
  useCheckDomainDns,
  getListDomainsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Plus, Trash2, Globe, CheckCircle2, XCircle, Webhook, Wifi, Copy, Server, Mail, BookOpen, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

type ServerInfo = { serverIp: string; smtpPort: number; mailDomain: string };

function useServerInfo() {
  const [info, setInfo] = useState<ServerInfo | null>(null);
  useEffect(() => {
    fetch("/api/admin/server-info").then((r) => r.json()).then(setInfo).catch(() => {});
  }, []);
  return info;
}

type DnsCheckResult = {
  domain: string;
  mxValid: boolean;
  mxRecords: string[];
  spfValid: boolean;
  spfRecords: string[];
  checkedAt: string;
};

function CopyButton({ value }: { value: string }) {
  const { toast } = useToast();
  return (
    <button
      className="ml-1 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-muted-foreground hover:text-foreground transition-colors"
      onClick={() => { navigator.clipboard.writeText(value); toast({ title: "Đã sao chép" }); }}
      title="Sao chép"
    >
      <Copy className="h-3 w-3" />
    </button>
  );
}

function DnsRecordRow({ type, host, value, priority }: { type: string; host: string; value: string; priority?: string }) {
  return (
    <div className="grid grid-cols-[60px_80px_1fr_70px] gap-2 px-4 py-2.5 text-xs items-center border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span className="font-mono font-bold text-violet-600 dark:text-violet-400">{type}</span>
      <span className="font-mono text-muted-foreground">{host}</span>
      <div className="flex items-center gap-1 min-w-0">
        <code className="font-mono text-foreground truncate">{value}</code>
        <CopyButton value={value} />
      </div>
      <span className="font-mono text-muted-foreground text-right">{priority ?? "—"}</span>
    </div>
  );
}

function DnsSetupGuide({ domain, serverInfo }: { domain: string; serverInfo: ServerInfo | null }) {
  const ip = serverInfo?.serverIp ?? "…";
  const mailDomain = serverInfo?.mailDomain ?? "mail.yourdomain.com";
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Thêm các record sau vào DNS manager của <strong className="text-foreground">{domain}</strong> (Cloudflare, Route53, Namecheap…):
      </p>
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="grid grid-cols-[60px_80px_1fr_70px] gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-slate-200 dark:border-slate-700">
          <span>Type</span><span>Host</span><span>Value</span><span className="text-right">Priority</span>
        </div>
        <DnsRecordRow type="A" host="mail" value={ip} />
        <DnsRecordRow type="MX" host="@" value={mailDomain} priority="10" />
        <DnsRecordRow type="TXT" host="@" value="v=spf1 mx ~all" />
      </div>
      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300">
        ⏱ DNS propagation thường mất <strong>vài phút đến 24h</strong>. Sau khi cấu hình xong, quay lại và nhấn nút <strong>DNS</strong> để kiểm tra.
      </div>
    </div>
  );
}

function DnsResultDialog({
  open, onOpenChange, result, onRecheck, isChecking,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  result: DnsCheckResult | null;
  onRecheck: () => void;
  isChecking: boolean;
}) {
  if (!result) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-indigo-500" />
            Kiểm tra DNS — {result.domain}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          {/* MX */}
          <div className={`rounded-lg border p-3 space-y-1.5 ${result.mxValid ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30" : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30"}`}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              {result.mxValid
                ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                : <XCircle className="h-4 w-4 text-red-500" />}
              <span className={result.mxValid ? "text-emerald-800 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}>
                MX Record — {result.mxValid ? "OK" : "Chưa tìm thấy"}
              </span>
            </div>
            {result.mxRecords.length > 0
              ? result.mxRecords.map((r) => <code key={r} className="block text-xs font-mono pl-6 text-foreground">{r}</code>)
              : <p className="text-xs pl-6 text-muted-foreground">Không tìm thấy MX record nào.</p>}
          </div>

          {/* SPF */}
          <div className={`rounded-lg border p-3 space-y-1.5 ${result.spfValid ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30" : "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30"}`}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              {result.spfValid
                ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                : <XCircle className="h-4 w-4 text-amber-500" />}
              <span className={result.spfValid ? "text-emerald-800 dark:text-emerald-300" : "text-amber-800 dark:text-amber-300"}>
                SPF Record (TXT) — {result.spfValid ? "OK" : "Chưa cấu hình"}
              </span>
            </div>
            {result.spfRecords.length > 0
              ? result.spfRecords.map((r) => <code key={r} className="block text-xs font-mono pl-6 text-foreground">{r}</code>)
              : <p className="text-xs pl-6 text-muted-foreground">Khuyến nghị: <code className="font-mono">v=spf1 mx ~all</code></p>}
          </div>

          <p className="text-xs text-muted-foreground text-right">Kiểm tra lúc: {new Date(result.checkedAt).toLocaleTimeString("vi-VN")}</p>

          <Button
            className="w-full gap-2"
            variant="outline"
            onClick={onRecheck}
            disabled={isChecking}
          >
            {isChecking ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Kiểm tra lại
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Domains() {
  const { data: domains, isLoading } = useListDomains();
  const createDomain = useCreateDomain();
  const updateDomain = useUpdateDomain();
  const deleteDomain = useDeleteDomain();
  const checkDns = useCheckDomainDns();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const serverInfo = useServerInfo();

  // Create dialog: step 0 = form, step 1 = DNS guide after success
  const [createStep, setCreateStep] = useState<0 | 1>(0);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [newDomainPublic, setNewDomainPublic] = useState(true);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [createdDomainName, setCreatedDomainName] = useState("");

  // Webhook edit dialog
  const [editingDomainId, setEditingDomainId] = useState<number | null>(null);
  const [editingWebhookUrl, setEditingWebhookUrl] = useState("");

  // DNS result dialog
  const [dnsResult, setDnsResult] = useState<DnsCheckResult | null>(null);
  const [dnsResultOpen, setDnsResultOpen] = useState(false);
  const [recheckId, setRecheckId] = useState<number | null>(null);

  // Setup guide dialog (for existing domains)
  const [setupGuideFor, setSetupGuideFor] = useState<string | null>(null);

  const resetCreateDialog = () => {
    setCreateStep(0);
    setNewDomain("");
    setNewDomainPublic(true);
    setNewWebhookUrl("");
    setCreatedDomainName("");
  };

  const handleCreate = () => {
    createDomain.mutate(
      { data: { name: newDomain, isPublic: newDomainPublic, webhookUrl: newWebhookUrl.trim() || null } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDomainsQueryKey() });
          setCreatedDomainName(newDomain.trim().toLowerCase());
          setCreateStep(1);
        },
        onError: () => toast({ title: "Thêm domain thất bại", variant: "destructive" }),
      },
    );
  };

  const handleSaveWebhook = (id: number) => {
    updateDomain.mutate(
      { id, data: { webhookUrl: editingWebhookUrl.trim() || null } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDomainsQueryKey() });
          setEditingDomainId(null);
          toast({ title: "Webhook đã lưu" });
        },
        onError: () => toast({ title: "URL webhook không hợp lệ", variant: "destructive" }),
      },
    );
  };

  const handleTogglePublic = (id: number, isPublic: boolean) => {
    updateDomain.mutate({ id, data: { isPublic } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListDomainsQueryKey() }),
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Xóa domain này sẽ xóa tất cả inbox và email liên quan. Tiếp tục?")) return;
    deleteDomain.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDomainsQueryKey() });
        toast({ title: "Domain đã xóa" });
      },
    });
  };

  const handleCheckDns = (id: number) => {
    setRecheckId(id);
    checkDns.mutate({ id }, {
      onSuccess: (res) => {
        setDnsResult(res as unknown as DnsCheckResult);
        setDnsResultOpen(true);
      },
      onError: () => toast({ title: "Không thể kiểm tra DNS", variant: "destructive" }),
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Domains</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Quản lý pool email suffix cho instance của bạn.</p>
          </div>

          {/* Create Dialog — 2 steps */}
          <Dialog open={isCreateOpen} onOpenChange={(o) => { setIsCreateOpen(o); if (!o) resetCreateDialog(); }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0 shrink-0">
                <Plus className="h-4 w-4 mr-2" /> Add Domain
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              {createStep === 0 ? (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-indigo-500" /> Thêm Domain Mới
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Tên Domain</Label>
                      <Input
                        placeholder="example.com"
                        value={newDomain}
                        onChange={(e) => setNewDomain(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && newDomain.trim() && handleCreate()}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                      <div>
                        <Label className="font-medium">Public</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">Cho phép tạo inbox ngẫu nhiên trên domain này</p>
                      </div>
                      <Switch checked={newDomainPublic} onCheckedChange={setNewDomainPublic} />
                    </div>
                    <div className="space-y-2">
                      <Label>Webhook URL (tùy chọn)</Label>
                      <Input
                        placeholder="https://hooks.example.com/incoming"
                        value={newWebhookUrl}
                        onChange={(e) => setNewWebhookUrl(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Nhận POST notification mỗi khi có email đến domain này.</p>
                    </div>
                    <Button
                      className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0 gap-2"
                      onClick={handleCreate}
                      disabled={createDomain.isPending || !newDomain.trim()}
                    >
                      {createDomain.isPending
                        ? <RefreshCw className="h-4 w-4 animate-spin" />
                        : <><ArrowRight className="h-4 w-4" /> Thêm & Xem hướng dẫn DNS</>}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      Domain đã thêm — Cấu hình DNS
                    </DialogTitle>
                  </DialogHeader>
                  <div className="pt-2">
                    <DnsSetupGuide domain={createdDomainName} serverInfo={serverInfo} />
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        className="flex-1 gap-1.5"
                        onClick={() => {
                          const d = domains?.find((x) => x.name === createdDomainName);
                          if (d) handleCheckDns(d.id);
                          setIsCreateOpen(false);
                          resetCreateDialog();
                        }}
                      >
                        <Wifi className="h-3.5 w-3.5" /> Kiểm tra DNS ngay
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={() => { setIsCreateOpen(false); resetCreateDialog(); }}
                      >
                        Xong
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* DNS Result Dialog */}
        <DnsResultDialog
          open={dnsResultOpen}
          onOpenChange={setDnsResultOpen}
          result={dnsResult}
          isChecking={checkDns.isPending}
          onRecheck={() => recheckId !== null && handleCheckDns(recheckId)}
        />

        {/* Setup Guide Dialog for existing domains */}
        <Dialog open={!!setupGuideFor} onOpenChange={(o) => { if (!o) setSetupGuideFor(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-violet-500" /> Hướng dẫn DNS — {setupGuideFor}
              </DialogTitle>
            </DialogHeader>
            <div className="pt-2">
              {setupGuideFor && <DnsSetupGuide domain={setupGuideFor} serverInfo={serverInfo} />}
            </div>
          </DialogContent>
        </Dialog>

        {/* Domain Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="grid grid-cols-[1fr_100px_80px_100px_auto] gap-4 px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Domain</span>
            <span>Status</span>
            <span>Public</span>
            <span>Emails</span>
            <span className="text-right pr-1">Actions</span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span className="text-sm">Đang tải...</span>
            </div>
          ) : !domains?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Globe className="h-10 w-10 opacity-20" />
              <p className="text-sm">Chưa có domain nào. Thêm một domain để bắt đầu.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {domains.map((domain) => (
                <div key={domain.id} className="grid grid-cols-[1fr_100px_80px_100px_auto] gap-4 items-center px-5 py-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-7 w-7 rounded-lg bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center shrink-0">
                      <Globe className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <span className="font-medium text-sm truncate">{domain.name}</span>
                    {domain.webhookUrl && (
                      <span title="Webhook configured">
                        <Webhook className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                      </span>
                    )}
                  </div>
                  <div>
                    <Badge className={domain.status === "active"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-0"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-0"}>
                      {domain.status}
                    </Badge>
                  </div>
                  <div>
                    <Switch
                      checked={domain.isPublic}
                      onCheckedChange={(v) => handleTogglePublic(domain.id, v)}
                      disabled={updateDomain.isPending}
                    />
                  </div>
                  <div className="text-sm font-medium tabular-nums">{domain.emailCount.toLocaleString()}</div>
                  <div className="flex items-center gap-1.5 justify-end">
                    {/* Setup Guide */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs gap-1"
                      onClick={() => setSetupGuideFor(domain.name)}
                      title="Hướng dẫn cấu hình DNS"
                    >
                      <BookOpen className="h-3 w-3" />
                      Setup
                    </Button>

                    {/* DNS Check */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs gap-1"
                      onClick={() => handleCheckDns(domain.id)}
                      disabled={checkDns.isPending && recheckId === domain.id}
                    >
                      {checkDns.isPending && recheckId === domain.id
                        ? <RefreshCw className="h-3 w-3 animate-spin" />
                        : <Wifi className="h-3 w-3" />}
                      DNS
                    </Button>

                    {/* Webhook */}
                    <Dialog
                      open={editingDomainId === domain.id}
                      onOpenChange={(o) => {
                        if (o) { setEditingDomainId(domain.id); setEditingWebhookUrl(domain.webhookUrl ?? ""); }
                        else setEditingDomainId(null);
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs gap-1">
                          <Webhook className="h-3 w-3" />
                          {domain.webhookUrl && <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Webhook — {domain.name}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 pt-2">
                          <Label>POST URL (để trống để tắt)</Label>
                          <Input
                            placeholder="https://hooks.example.com/incoming"
                            value={editingWebhookUrl}
                            onChange={(e) => setEditingWebhookUrl(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Mỗi email đến trigger một POST với JSON payload (event, from, to, subject, preview...).
                          </p>
                          <Button className="w-full" onClick={() => handleSaveWebhook(domain.id)} disabled={updateDomain.isPending}>
                            Lưu webhook
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      onClick={() => handleDelete(domain.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
