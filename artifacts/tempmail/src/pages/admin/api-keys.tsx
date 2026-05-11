import { AdminLayout } from "@/components/layout/admin-layout";
import {
  useListApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  useDeleteApiKey,
  getListApiKeysQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, RefreshCw, Trash2, Key, Copy, AlertCircle, Ban } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";

export default function ApiKeys() {
  const { data: keys, isLoading } = useListApiKeys();
  const create = useCreateApiKey();
  const revoke = useRevokeApiKey();
  const del = useDeleteApiKey();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: getListApiKeysQueryKey() });

  const submit = () => {
    if (!name.trim()) return;
    create.mutate(
      { data: { name: name.trim() } },
      {
        onSuccess: (res) => { setNewSecret(res.plaintext); setName(""); refresh(); },
        onError: () => toast({ title: "Tạo key thất bại", variant: "destructive" }),
      },
    );
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Đã copy vào clipboard" });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Cấp quyền truy cập API cho AI agents và tích hợp.{" "}
              <Link href="/admin/api-docs" className="text-violet-600 dark:text-violet-400 hover:underline">
                Xem API docs →
              </Link>
            </p>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setNewSecret(null); }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0 shrink-0">
                <Plus className="h-4 w-4 mr-2" /> Tạo Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{newSecret ? "Lưu key của bạn ngay" : "Tạo API Key"}</DialogTitle>
              </DialogHeader>
              {newSecret ? (
                <div className="space-y-4 pt-2">
                  <div className="flex gap-2 items-start text-sm bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 rounded-lg p-3">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>Đây là lần duy nhất key đầy đủ được hiển thị. Copy ngay và lưu an toàn.</div>
                  </div>
                  <div className="font-mono text-sm bg-slate-100 dark:bg-slate-800 p-3 rounded-lg break-all border select-all">
                    {newSecret}
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 border-0" onClick={() => copy(newSecret)}>
                      <Copy className="h-4 w-4 mr-2" /> Copy
                    </Button>
                    <Button variant="outline" onClick={() => { setOpen(false); setNewSecret(null); }}>Xong</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Tên / mục đích</Label>
                    <Input
                      placeholder="VD: Zapier integration"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                    />
                  </div>
                  <Button
                    className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 border-0"
                    onClick={submit}
                    disabled={create.isPending || !name.trim()}
                  >
                    {create.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Tạo key"}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="grid grid-cols-[1fr_110px_100px_100px_80px_auto] gap-4 px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Tên</span>
            <span>Prefix</span>
            <span>Tạo</span>
            <span>Dùng lần cuối</span>
            <span>Status</span>
            <span className="text-right pr-1">Actions</span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span className="text-sm">Đang tải...</span>
            </div>
          ) : !keys?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Key className="h-10 w-10 opacity-20" />
              <p className="text-sm">Chưa có API key. Tạo một key để cấp quyền cho agents.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {keys.map((k) => (
                <div key={k.id} className="grid grid-cols-[1fr_110px_100px_100px_80px_auto] gap-4 items-center px-5 py-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="font-medium text-sm">{k.name}</div>
                  <div className="font-mono text-xs text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    {k.prefix}…
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(k.createdAt), { addSuffix: true })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {k.lastUsedAt ? formatDistanceToNow(new Date(k.lastUsedAt), { addSuffix: true }) : "Chưa dùng"}
                  </div>
                  <div>
                    {k.revokedAt ? (
                      <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-0 text-xs">Revoked</Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-0 text-xs">Active</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 justify-end">
                    {!k.revokedAt && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1"
                        onClick={() => revoke.mutate({ id: k.id }, { onSuccess: () => { refresh(); toast({ title: "Đã revoke" }); } })}
                        disabled={revoke.isPending}
                      >
                        <Ban className="h-3 w-3" /> Revoke
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      onClick={() => del.mutate({ id: k.id }, { onSuccess: () => { refresh(); toast({ title: "Đã xóa" }); } })}
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
