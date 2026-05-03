import { AccountLayout, useMe } from "@/components/layout/account-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, RefreshCw, Trash2, Key, Copy, AlertCircle, Ban, Crown } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";

type ApiKey = { id: number; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };

export default function AccountApiKeys() {
  const { data: me } = useMe();
  if (me && me.plan !== "pro") {
    return (
      <AccountLayout>
        <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Crown className="h-5 w-5 text-amber-600" /> API chỉ có ở gói Pro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Nâng cấp để cho phép AI agent truy cập inbox của bạn qua API.
            </p>
            <Link href="/account/plan">
              <Button>Xem gói cước</Button>
            </Link>
          </CardContent>
        </Card>
      </AccountLayout>
    );
  }
  return (
    <AccountLayout>
      <ApiKeysInner />
    </AccountLayout>
  );
}

function ApiKeysInner() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const { data, isLoading } = useQuery<ApiKey[]>({
    queryKey: ["/account/api-keys"],
    queryFn: () => apiFetch<ApiKey[]>("/api/account/api-keys"),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["/account/api-keys"] });

  const create = useMutation({
    mutationFn: (n: string) =>
      apiFetch<{ plaintext: string }>("/api/account/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: n }),
      }),
    onSuccess: (res) => {
      setNewSecret(res.plaintext);
      setName("");
      refresh();
    },
    onError: (e: Error) => toast({ title: "Tạo key thất bại", description: e.message, variant: "destructive" }),
  });

  const revoke = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/account/api-keys/${id}/revoke`, { method: "POST" }),
    onSuccess: () => { refresh(); toast({ title: "Đã thu hồi" }); },
  });

  const del = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/account/api-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => { refresh(); toast({ title: "Đã xoá" }); },
  });

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Đã sao chép" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
          <p className="text-muted-foreground">Cấp quyền cho AI agent truy cập tài khoản của bạn.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setNewSecret(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-key"><Plus className="h-4 w-4 mr-2" /> Tạo key</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{newSecret ? "Lưu key này ngay" : "Tạo API key"}</DialogTitle>
            </DialogHeader>
            {newSecret ? (
              <div className="space-y-4 pt-2">
                <div className="flex gap-2 items-start text-sm bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>Key chỉ hiện 1 lần. Hãy sao chép và lưu nơi an toàn.</div>
                </div>
                <div className="font-mono text-sm bg-muted p-3 rounded-lg break-all" data-testid="text-new-key">{newSecret}</div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => copy(newSecret)}><Copy className="h-4 w-4 mr-2" /> Sao chép</Button>
                  <Button variant="outline" onClick={() => { setOpen(false); setNewSecret(null); }}>Xong</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Tên / mục đích</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="vd: Zapier, n8n agent..." data-testid="input-key-name" />
                </div>
                <Button className="w-full" onClick={() => create.mutate(name.trim())} disabled={create.isPending || !name.trim()}>
                  {create.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Tạo"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border rounded-lg shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead>Tạo</TableHead>
              <TableHead>Dùng lần cuối</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center"><RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : !data?.length ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                <Key className="h-6 w-6 mx-auto mb-2 opacity-40" /> Chưa có API key nào.
              </TableCell></TableRow>
            ) : (
              data.map((k) => (
                <TableRow key={k.id} data-testid={`row-key-${k.id}`}>
                  <TableCell className="font-medium">{k.name}</TableCell>
                  <TableCell className="font-mono text-xs">{k.prefix}…</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(k.createdAt), { addSuffix: true })}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{k.lastUsedAt ? formatDistanceToNow(new Date(k.lastUsedAt), { addSuffix: true }) : "Chưa dùng"}</TableCell>
                  <TableCell>
                    {k.revokedAt ? <Badge variant="destructive">Thu hồi</Badge> : <Badge className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">Hoạt động</Badge>}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {!k.revokedAt && (
                      <Button variant="outline" size="sm" onClick={() => revoke.mutate(k.id)}><Ban className="h-3 w-3 mr-1" /> Thu hồi</Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => del.mutate(k.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
