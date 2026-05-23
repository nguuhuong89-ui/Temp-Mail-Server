import { AdminLayout } from "@/components/layout/admin-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Crown, RefreshCw, ShieldOff, Users, Inbox, Key, Globe, Search, Trash2, UserPlus, ArrowUpCircle, ArrowDownCircle, Shield, X } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";

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

function Avatar({ user }: { user: AdminUser }) {
  return (
    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
      user.role === "admin"
        ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
    }`}>
      {(user.email?.[0] ?? "?").toUpperCase()}
    </div>
  );
}

export default function AdminUsers() {
  const qc = useQueryClient();
  const { toast } = useToast();

  // Filters
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState<"all" | "free" | "pro">("all");
  const [filterRole, setFilterRole] = useState<"all" | "user" | "admin">("all");

  // Detail drawer
  const [selected, setSelected] = useState<AdminUser | null>(null);

  // Promote dialog
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteEmail, setPromoteEmail] = useState("");

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const { data, isLoading, isFetching } = useQuery<AdminUser[]>({
    queryKey: ["/admin/users"],
    queryFn: () => apiFetch<AdminUser[]>("/api/admin/users"),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter((u) => {
      if (filterPlan !== "all" && u.plan !== filterPlan) return false;
      if (filterRole !== "all" && u.role !== filterRole) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!u.email?.toLowerCase().includes(q) && !u.id.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [data, search, filterPlan, filterRole]);

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiFetch(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["/admin/users"] });
      toast({ title: "Đã cập nhật" });
      if (selected?.id === vars.id) setSelected(null);
    },
    onError: (e: Error) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const sync = useMutation({
    mutationFn: () => apiFetch<{ added: number; updated: number }>("/api/admin/users/sync", { method: "POST" }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["/admin/users"] });
      toast({ title: `Đồng bộ xong: +${r.added} mới, ${r.updated} cập nhật` });
    },
    onError: (e: Error) => toast({ title: "Lỗi đồng bộ", description: e.message, variant: "destructive" }),
  });

  const promote = useMutation({
    mutationFn: (email: string) =>
      apiFetch("/api/admin/users/promote", { method: "POST", body: JSON.stringify({ email }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/admin/users"] });
      toast({ title: "Đã set Admin" });
      setPromoteOpen(false);
      setPromoteEmail("");
    },
    onError: (e: Error) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/admin/users"] });
      toast({ title: "Đã xoá user" });
      setDeleteTarget(null);
      if (selected) setSelected(null);
    },
    onError: (e: Error) => toast({ title: "Lỗi xoá", description: e.message, variant: "destructive" }),
  });

  const stats = useMemo(() => ({
    total: data?.length ?? 0,
    pro: data?.filter((u) => u.plan === "pro").length ?? 0,
    admins: data?.filter((u) => u.role === "admin").length ?? 0,
  }), [data]);

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Người dùng</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Quản lý gói cước, phân quyền và đồng bộ từ Clerk.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
              <Users className="h-3.5 w-3.5" /> {stats.total} tổng
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <Crown className="h-3.5 w-3.5 text-amber-500" /> {stats.pro} Pro
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <Shield className="h-3.5 w-3.5 text-violet-500" /> {stats.admins} Admin
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setPromoteOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" /> Thêm Admin
            </Button>
            <Button
              size="sm"
              className="gap-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white border-0"
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${sync.isPending ? "animate-spin" : ""}`} />
              Đồng bộ Clerk
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-sm"
              placeholder="Tìm theo email hoặc ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearch("")}>
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Select value={filterPlan} onValueChange={(v) => setFilterPlan(v as typeof filterPlan)}>
            <SelectTrigger className="h-8 text-sm w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả gói</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterRole} onValueChange={(v) => setFilterRole(v as typeof filterRole)}>
            <SelectTrigger className="h-8 text-sm w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả quyền</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="grid grid-cols-[1fr_85px_85px_55px_55px_55px_100px_auto] gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Email</span><span>Gói</span><span>Quyền</span>
            <span className="text-center">Inbox</span><span className="text-center">Keys</span><span className="text-center">Domain</span>
            <span>Tạo</span><span className="text-right">Hành động</span>
          </div>

          {isLoading || isFetching && !data ? (
            <div className="flex items-center justify-center py-14 text-muted-foreground gap-2">
              <RefreshCw className="h-5 w-5 animate-spin" /><span className="text-sm">Đang tải…</span>
            </div>
          ) : !filtered.length ? (
            <div className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-3">
              <Users className="h-10 w-10 opacity-20" />
              <p className="text-sm">{data?.length ? "Không tìm thấy user nào khớp bộ lọc." : "Chưa có user nào — nhấn \"Đồng bộ Clerk\" để tải về."}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((u) => (
                <div
                  key={u.id}
                  className="grid grid-cols-[1fr_85px_85px_55px_55px_55px_100px_auto] gap-2 items-center px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                  onClick={() => setSelected(u)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar user={u} />
                    <span className="text-sm font-medium truncate">
                      {u.email ?? <span className="text-muted-foreground italic text-xs">no email</span>}
                    </span>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    {u.plan === "pro" ? (
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border-0 gap-1 text-xs cursor-pointer"
                        onClick={() => patch.mutate({ id: u.id, body: { plan: "free" } })}>
                        <Crown className="h-3 w-3" /> Pro
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs cursor-pointer"
                        onClick={() => patch.mutate({ id: u.id, body: { plan: "pro" } })}>
                        Free
                      </Badge>
                    )}
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    {u.role === "admin" ? (
                      <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border-0 text-xs cursor-pointer"
                        onClick={() => patch.mutate({ id: u.id, body: { role: "user" } })}>
                        Admin
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground cursor-pointer"
                        onClick={() => patch.mutate({ id: u.id, body: { role: "admin" } })}>
                        User
                      </Badge>
                    )}
                  </div>
                  <div className="text-center text-sm font-medium">{u.inboxCount}</div>
                  <div className="text-center text-sm font-medium">{u.apiKeyCount}</div>
                  <div className="text-center text-sm font-medium">{u.domainCount}</div>
                  <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}</div>
                  <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                    {u.plan === "pro" ? (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-orange-600"
                        title="Hạ xuống Free" disabled={patch.isPending}
                        onClick={() => patch.mutate({ id: u.id, body: { plan: "free" } })}>
                        <ArrowDownCircle className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-amber-500 hover:text-amber-600"
                        title="Nâng lên Pro" disabled={patch.isPending}
                        onClick={() => patch.mutate({ id: u.id, body: { plan: "pro" } })}>
                        <ArrowUpCircle className="h-4 w-4" />
                      </Button>
                    )}
                    {u.role !== "admin" ? (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-violet-500 hover:text-violet-600"
                        title="Set Admin" disabled={patch.isPending}
                        onClick={() => patch.mutate({ id: u.id, body: { role: "admin" } })}>
                        <Shield className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        title="Bỏ quyền Admin" disabled={patch.isPending}
                        onClick={() => patch.mutate({ id: u.id, body: { role: "user" } })}>
                        <ShieldOff className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                      title="Xoá user" onClick={() => setDeleteTarget(u)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Result count */}
        {!isLoading && filtered.length > 0 && (
          <p className="text-xs text-muted-foreground text-right">
            Hiển thị {filtered.length} / {data?.length ?? 0} users
          </p>
        )}
      </div>

      {/* User detail drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-[380px] sm:w-[440px] overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="pb-4 border-b">
                <div className="flex items-center gap-3">
                  <Avatar user={selected} />
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-base truncate">{selected.email ?? "no email"}</SheetTitle>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{selected.id}</p>
                  </div>
                </div>
              </SheetHeader>

              <div className="py-5 space-y-5">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: Inbox, label: "Inbox", value: selected.inboxCount, color: "text-indigo-500" },
                    { icon: Key, label: "API Keys", value: selected.apiKeyCount, color: "text-sky-500" },
                    { icon: Globe, label: "Domains", value: selected.domainCount, color: "text-emerald-500" },
                  ].map(({ icon: Icon, label, value, color }) => (
                    <div key={label} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-center">
                      <Icon className={`h-4 w-4 mx-auto mb-1 ${color}`} />
                      <p className="text-lg font-bold">{value}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Info */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-muted-foreground">Gói</span>
                    {selected.plan === "pro"
                      ? <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border-0 gap-1"><Crown className="h-3 w-3" />Pro</Badge>
                      : <Badge variant="secondary">Free</Badge>}
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-muted-foreground">Quyền</span>
                    {selected.role === "admin"
                      ? <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border-0">Admin</Badge>
                      : <Badge variant="outline">User</Badge>}
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-muted-foreground">Tạo lúc</span>
                    <span className="text-xs">{format(new Date(selected.createdAt), "dd/MM/yyyy HH:mm")}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hành động</p>
                  <div className="grid grid-cols-2 gap-2">
                    {selected.plan === "pro" ? (
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                        disabled={patch.isPending}
                        onClick={() => patch.mutate({ id: selected.id, body: { plan: "free" } })}>
                        <ArrowDownCircle className="h-3.5 w-3.5" /> Hạ xuống Free
                      </Button>
                    ) : (
                      <Button size="sm" className="gap-1.5 text-xs bg-amber-500 hover:bg-amber-400 text-white border-0"
                        disabled={patch.isPending}
                        onClick={() => patch.mutate({ id: selected.id, body: { plan: "pro" } })}>
                        <Crown className="h-3.5 w-3.5" /> Nâng lên Pro
                      </Button>
                    )}
                    {selected.role !== "admin" ? (
                      <Button size="sm" className="gap-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white border-0"
                        disabled={patch.isPending}
                        onClick={() => patch.mutate({ id: selected.id, body: { role: "admin" } })}>
                        <Shield className="h-3.5 w-3.5" /> Set Admin
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                        disabled={patch.isPending}
                        onClick={() => patch.mutate({ id: selected.id, body: { role: "user" } })}>
                        <ShieldOff className="h-3.5 w-3.5" /> Bỏ quyền Admin
                      </Button>
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs text-red-500 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30 mt-1"
                    onClick={() => setDeleteTarget(selected)}>
                    <Trash2 className="h-3.5 w-3.5" /> Xoá user và tất cả dữ liệu
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Promote by email dialog */}
      <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-violet-500" /> Thêm Admin theo email
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Nhập email của user Clerk. Nếu chưa có trong DB, sẽ tự tạo từ Clerk.</p>
            <Input
              placeholder="email@example.com"
              value={promoteEmail}
              onChange={(e) => setPromoteEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && promoteEmail.trim() && promote.mutate(promoteEmail.trim())}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPromoteOpen(false)}>Huỷ</Button>
            <Button size="sm" className="bg-violet-600 hover:bg-violet-500 text-white border-0"
              disabled={!promoteEmail.trim() || promote.isPending}
              onClick={() => promote.mutate(promoteEmail.trim())}>
              {promote.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
              Set Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-4 w-4" /> Xoá user?
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <p className="text-sm">Bạn chắc chắn muốn xoá <strong>{deleteTarget?.email}</strong>?</p>
            <p className="text-xs text-muted-foreground">Hành động này sẽ xoá tất cả inboxes, emails, API keys và domains của user này. Không thể hoàn tác.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Huỷ</Button>
            <Button size="sm" variant="destructive"
              disabled={deleteUser.isPending}
              onClick={() => deleteTarget && deleteUser.mutate(deleteTarget.id)}>
              {deleteUser.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Xoá
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
