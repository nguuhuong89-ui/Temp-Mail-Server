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

type Domain = {
  id: number;
  name: string;
  status: string;
  verifiedAt: string | null;
  verificationToken: string | null;
  verificationRecord: string | null;
  createdAt: string;
};

export default function AccountDomains() {
  const { data: me } = useMe();
  if (me && me.plan !== "pro") {
    return (
      <AccountLayout>
        <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Crown className="h-5 w-5 text-amber-600" /> Custom domain chỉ có ở gói Pro</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/account/plan"><Button>Xem gói cước</Button></Link>
          </CardContent>
        </Card>
      </AccountLayout>
    );
  }
  return <AccountLayout><DomainsInner /></AccountLayout>;
}

function DomainsInner() {
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
    onSuccess: () => { setName(""); setOpen(false); refresh(); toast({ title: "Đã thêm domain. Hãy verify DNS." }); },
    onError: (e: Error) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const verify = useMutation({
    mutationFn: (id: number) => apiFetch<{ ok: boolean }>(`/api/account/domains/${id}/verify`, { method: "POST" }),
    onSuccess: () => { refresh(); toast({ title: "Verify thành công 🎉" }); },
    onError: (e: Error) => toast({ title: "Verify thất bại", description: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/account/domains/${id}`, { method: "DELETE" }),
    onSuccess: () => { refresh(); toast({ title: "Đã xoá" }); },
  });

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast({ title: "Đã sao chép" }); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Domain riêng</h1>
          <p className="text-muted-foreground">Trỏ domain của bạn về dịch vụ này để dùng địa chỉ email tuỳ chỉnh.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-domain"><Plus className="h-4 w-4 mr-2" /> Thêm domain</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Thêm domain mới</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Tên domain</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="vd: mail.example.com" data-testid="input-domain-name" />
              </div>
              <Button className="w-full" onClick={() => add.mutate(name.trim().toLowerCase())} disabled={add.isPending || !name.trim()}>
                {add.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Thêm"}
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
          Chưa có domain nào.
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
                    <Badge className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" /> Đã verify</Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300"><AlertCircle className="h-3 w-3 mr-1" /> Chờ verify</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {!d.verifiedAt && (
                    <Button variant="outline" size="sm" onClick={() => verify.mutate(d.id)} disabled={verify.isPending} data-testid={`button-verify-${d.id}`}>
                      {verify.isPending ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />} Verify ngay
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => del.mutate(d.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              {!d.verifiedAt && d.verificationRecord && (
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <p className="text-muted-foreground mb-2">Thêm bản ghi DNS sau vào domain <span className="font-mono">{d.name}</span>:</p>
                    <div className="bg-muted rounded-lg p-3 space-y-2 font-mono text-xs">
                      <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center">
                        <span className="text-muted-foreground">Loại:</span>
                        <span>TXT</span>
                        <span></span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center">
                        <span className="text-muted-foreground">Tên:</span>
                        <span>@ (hoặc {d.name})</span>
                        <span></span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center">
                        <span className="text-muted-foreground">Giá trị:</span>
                        <span className="break-all" data-testid={`text-record-${d.id}`}>{d.verificationRecord}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copy(d.verificationRecord!)}><Copy className="h-3 w-3" /></Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">DNS có thể mất vài phút đến vài giờ để cập nhật. Sau khi xong, bấm "Verify ngay".</p>
                  </div>
                  <div className="text-xs text-muted-foreground border-t pt-3">
                    <p className="font-medium mb-1">Sau khi verify xong, để nhận mail bạn cần thêm bản ghi MX:</p>
                    <p className="font-mono">MX 10 → trỏ về máy chủ mail của hệ thống này (xem trang Setup Guide).</p>
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
