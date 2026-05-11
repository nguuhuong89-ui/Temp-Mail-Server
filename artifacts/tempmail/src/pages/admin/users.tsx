import { AdminLayout } from "@/components/layout/admin-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Crown, RefreshCw, ShieldOff, ArrowUp, ArrowDown, Users, Inbox, Key, Globe } from "lucide-react";
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Người dùng</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Nâng/hạ gói cước và phân quyền admin.</p>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-medium text-muted-foreground">
            {data?.length ?? 0} users
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_90px_90px_60px_60px_60px_110px_auto] gap-3 px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Email</span>
            <span>Gói</span>
            <span>Quyền</span>
            <span className="text-center">Inbox</span>
            <span className="text-center">Keys</span>
            <span className="text-center">Domain</span>
            <span>Tạo</span>
            <span className="text-right pr-1">Hành động</span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span className="text-sm">Đang tải...</span>
            </div>
          ) : !data?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Users className="h-10 w-10 opacity-20" />
              <p className="text-sm">Chưa có user nào đăng ký.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.map((u) => (
                <div
                  key={u.id}
                  data-testid={`row-user-${u.id}`}
                  className="grid grid-cols-[1fr_90px_90px_60px_60px_60px_110px_auto] gap-3 items-center px-5 py-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {/* Email */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      u.role === "admin"
                        ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}>
                      {(u.email?.[0] ?? "?").toUpperCase()}
                    </div>
                    <span className="text-sm font-medium truncate">
                      {u.email ?? <span className="text-muted-foreground italic text-xs">no email</span>}
                    </span>
                  </div>

                  {/* Plan */}
                  <div>
                    {u.plan === "pro" ? (
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border-0 gap-1">
                        <Crown className="h-3 w-3" /> Pro
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Free</Badge>
                    )}
                  </div>

                  {/* Role */}
                  <div>
                    {u.role === "admin" ? (
                      <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border-0 text-xs">Admin</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">User</Badge>
                    )}
                  </div>

                  {/* Counts */}
                  <div className="text-center">
                    <span className="text-sm font-medium">{u.inboxCount}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-medium">{u.apiKeyCount}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-medium">{u.domainCount}</span>
                  </div>

                  {/* Created */}
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 justify-end">
                    {u.plan === "pro" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1"
                        onClick={() => patch.mutate({ id: u.id, body: { plan: "free" } })}
                        data-testid={`button-downgrade-${u.id}`}
                        disabled={patch.isPending}
                      >
                        <ArrowDown className="h-3 w-3" /> Free
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400"
                        onClick={() => patch.mutate({ id: u.id, body: { plan: "pro" } })}
                        data-testid={`button-upgrade-${u.id}`}
                        disabled={patch.isPending}
                      >
                        <Crown className="h-3 w-3" /> Pro
                      </Button>
                    )}
                    {u.role === "admin" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1 text-muted-foreground"
                        onClick={() => patch.mutate({ id: u.id, body: { role: "user" } })}
                        disabled={patch.isPending}
                      >
                        <ShieldOff className="h-3 w-3" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1 text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                        onClick={() => patch.mutate({ id: u.id, body: { role: "admin" } })}
                        disabled={patch.isPending}
                      >
                        Admin
                      </Button>
                    )}
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
