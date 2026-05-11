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
import { RefreshCw, Plus, Trash2, Globe, CheckCircle2, XCircle, Webhook, Wifi } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

export default function Domains() {
  const { data: domains, isLoading } = useListDomains();
  const createDomain = useCreateDomain();
  const updateDomain = useUpdateDomain();
  const deleteDomain = useDeleteDomain();
  const checkDns = useCheckDomainDns();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [newDomainPublic, setNewDomainPublic] = useState(true);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [editingDomainId, setEditingDomainId] = useState<number | null>(null);
  const [editingWebhookUrl, setEditingWebhookUrl] = useState("");

  const handleCreate = () => {
    createDomain.mutate(
      { data: { name: newDomain, isPublic: newDomainPublic, webhookUrl: newWebhookUrl.trim() || null } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDomainsQueryKey() });
          setIsCreateOpen(false);
          setNewDomain("");
          setNewWebhookUrl("");
          toast({ title: "Domain đã được thêm" });
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
    checkDns.mutate({ id }, {
      onSuccess: (res) => {
        if (res.mxValid) {
          toast({ title: "DNS OK", description: "MX record đã được cấu hình đúng." });
        } else {
          toast({ title: "DNS chưa đúng", description: "MX record bị thiếu hoặc sai.", variant: "destructive" });
        }
      },
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
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0 shrink-0">
                <Plus className="h-4 w-4 mr-2" /> Add Domain
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Thêm Domain Mới</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Tên Domain</Label>
                  <Input placeholder="example.com" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} />
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
                  <p className="text-xs text-muted-foreground">
                    Nhận POST notification mỗi khi có email đến domain này.
                  </p>
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0"
                  onClick={handleCreate}
                  disabled={createDomain.isPending || !newDomain}
                >
                  {createDomain.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Thêm Domain"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Table header */}
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
                    <Badge
                      className={domain.status === "active"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-0"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-0"}
                    >
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
                    {/* Webhook edit */}
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
                          Webhook
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
                          <Button
                            className="w-full"
                            onClick={() => handleSaveWebhook(domain.id)}
                            disabled={updateDomain.isPending}
                          >
                            Lưu webhook
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs gap-1"
                      onClick={() => handleCheckDns(domain.id)}
                      disabled={checkDns.isPending}
                    >
                      <Wifi className="h-3 w-3" />
                      DNS
                    </Button>

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
