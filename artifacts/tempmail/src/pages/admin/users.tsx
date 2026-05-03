import { AdminLayout } from "@/components/layout/admin-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Crown, RefreshCw, ShieldOff, ArrowUp, ArrowDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type AdminUser = {
  id: string;
  email: string | null;
  plan: "free" | "pro";
  role: "user" | "admin";
  createdAt: string;
  apiKeyCount: number;
  inboxCount: number;
  domainCount: number;
};

export default function AdminUsers() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/admin/users"],
    queryFn: () => apiFetch<AdminUser[]>("/api/admin/users"),
  });
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiFetch(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/admin/users"] }); toast({ title: "Đã cập nhật" }); },
    onError: (e: Error) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Người dùng</h1>
          <p className="text-muted-foreground">Nâng/hạ gói cước và phân quyền admin.</p>
        </div>
        <div className="bg-card border rounded-lg shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Gói</TableHead>
                <TableHead>Quyền</TableHead>
                <TableHead className="text-right">Inbox</TableHead>
                <TableHead className="text-right">API Key</TableHead>
                <TableHead className="text-right">Domain</TableHead>
                <TableHead>Tạo</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="h-24 text-center"><RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : !data?.length ? (
                <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">Chưa có user nào.</TableCell></TableRow>
              ) : (
                data.map((u) => (
                  <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                    <TableCell className="font-medium">{u.email ?? <span className="text-muted-foreground italic">no email</span>}</TableCell>
                    <TableCell>
                      {u.plan === "pro" ? <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"><Crown className="h-3 w-3 mr-1" /> Pro</Badge> : <Badge variant="secondary">Free</Badge>}
                    </TableCell>
                    <TableCell>
                      {u.role === "admin" ? <Badge variant="outline">Admin</Badge> : <Badge variant="outline">User</Badge>}
                    </TableCell>
                    <TableCell className="text-right">{u.inboxCount}</TableCell>
                    <TableCell className="text-right">{u.apiKeyCount}</TableCell>
                    <TableCell className="text-right">{u.domainCount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {u.plan === "pro" ? (
                        <Button variant="outline" size="sm" onClick={() => patch.mutate({ id: u.id, body: { plan: "free" } })} data-testid={`button-downgrade-${u.id}`}>
                          <ArrowDown className="h-3 w-3 mr-1" /> Hạ Free
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => patch.mutate({ id: u.id, body: { plan: "pro" } })} data-testid={`button-upgrade-${u.id}`}>
                          <ArrowUp className="h-3 w-3 mr-1" /> Nâng Pro
                        </Button>
                      )}
                      {u.role === "admin" ? (
                        <Button variant="ghost" size="sm" onClick={() => patch.mutate({ id: u.id, body: { role: "user" } })}>
                          <ShieldOff className="h-3 w-3 mr-1" /> Bỏ admin
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => patch.mutate({ id: u.id, body: { role: "admin" } })}>
                          Cho admin
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
