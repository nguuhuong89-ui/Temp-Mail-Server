import { AccountLayout } from "@/components/layout/account-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Inbox as InboxIcon, RefreshCw, Trash2, ExternalLink, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type AccountInbox = { id: number; address: string; createdAt: string; expiresAt: string; emailCount: number; token?: string };

export default function AccountInboxes() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery<AccountInbox[]>({
    queryKey: ["/account/inboxes"],
    queryFn: () => apiFetch<AccountInbox[]>("/api/account/inboxes"),
  });
  const del = useMutation({
    mutationFn: (address: string) =>
      apiFetch(`/api/account/inboxes/${encodeURIComponent(address)}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/account/inboxes"] });
      toast({ title: "Đã xoá inbox" });
    },
  });

  return (
    <AccountLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inbox của tôi</h1>
          <p className="text-muted-foreground">Tất cả inbox bạn đã tạo khi đăng nhập sẽ được lưu lại.</p>
        </div>
        <div className="bg-card border rounded-lg shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Địa chỉ</TableHead>
                <TableHead>Tạo lúc</TableHead>
                <TableHead>Hết hạn</TableHead>
                <TableHead className="text-right">Email</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell></TableRow>
              ) : !data?.length ? (
                <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <InboxIcon className="h-8 w-8 opacity-30" />
                    <p>Chưa có inbox nào được lưu.</p>
                    <p className="text-xs">Inbox sẽ tự động lưu khi bạn tạo hoặc xem inbox khi đã đăng nhập.</p>
                  </div>
                </TableCell></TableRow>
              ) : (
                data.map((i) => {
                  const expired = new Date(i.expiresAt) < new Date();
                  return (
                  <TableRow key={i.id} data-testid={`row-inbox-${i.id}`} className={expired ? "opacity-60" : ""}>
                    <TableCell className="font-mono text-sm">
                      <div className="flex items-center gap-2">
                        {i.address}
                        <Badge className={expired ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-0 text-xs" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-0 text-xs"}>
                          {expired ? "Hết hạn" : "Active"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(i.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {expired ? <span className="text-rose-500">{formatDistanceToNow(new Date(i.expiresAt), { addSuffix: true })}</span> : formatDistanceToNow(new Date(i.expiresAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <span className="flex items-center justify-end gap-1">
                        <Mail className="h-3 w-3 text-muted-foreground" />{i.emailCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Link href={`/inbox/${i.address}`}>
                        <Button variant="outline" size="sm"><ExternalLink className="h-3 w-3 mr-1" /> Mở</Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => del.mutate(i.address)}
                        data-testid={`button-delete-${i.id}`}
                      >
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
    </AccountLayout>
  );
}
