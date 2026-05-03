import { AccountLayout } from "@/components/layout/account-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Inbox as InboxIcon, RefreshCw, Trash2, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type AccountInbox = { id: number; address: string; createdAt: string; expiresAt: string; emailCount: number };

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
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  <InboxIcon className="h-6 w-6 mx-auto mb-2 opacity-40" />
                  Chưa có inbox nào. Hãy tạo từ trang chủ.
                </TableCell></TableRow>
              ) : (
                data.map((i) => (
                  <TableRow key={i.id} data-testid={`row-inbox-${i.id}`}>
                    <TableCell className="font-mono text-sm">{i.address}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(i.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(i.expiresAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right font-medium">{i.emailCount}</TableCell>
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
