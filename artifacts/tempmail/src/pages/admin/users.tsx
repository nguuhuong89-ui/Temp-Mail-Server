import { AdminLayout } from "@/components/layout/admin-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Crown, RefreshCw, ShieldOff, Users, Inbox, Key, Globe, Search, Trash2, UserPlus, ArrowUpCircle, ArrowDownCircle, Shield, X, Mail, ScrollText } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

type UserDetail = {
  user: {
    id: string;
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    plan: string;
    role: string;
    lastLoginAt: string | null;
    deletedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  inboxes: Array<{ id: number; address: string; createdAt: string; expiresAt: string; emailCount: number }>;
  domains: Array<{ id: number; name: string; status: string; createdAt: string }>;
  apiKeys: Array<{ id: number; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null }>;
  recentEmails: Array<{ id: number; toAddress: string; fromAddress: string; subject: string; receivedAt: string }>;
  recentAudit: Array<{ id: number; action: string; targetType: string | null; targetId: string | null; createdAt: string }>;
};

function Avatar({ user }: { user: AdminUser }) {
  return (
    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
      user.role === "admin"
        ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
    }`}>
      {(user.id.slice(4, 5) || "?").toUpperCase()}
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
  const [promoteUserId, setPromoteUserId] = useState("");

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
        if (!u.id.toLowerCase().includes(q) && !(u.email ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [data, search, filterPlan, filterRole]);

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiFetch(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["/admin/users"] });
      toast({ title: "Updated" });
      if (selected?.id === vars.id) setSelected(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const sync = useMutation({
    mutationFn: () => apiFetch<{ added: number; updated: number }>("/api/admin/users/sync", { method: "POST" }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["/admin/users"] });
      toast({ title: `Sync done: +${r.added} added, ${r.updated} updated` });
    },
    onError: (e: Error) => toast({ title: "Sync error", description: e.message, variant: "destructive" }),
  });

  const promote = useMutation({
    mutationFn: (userId: string) =>
      apiFetch("/api/admin/users/promote", { method: "POST", body: JSON.stringify({ userId }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/admin/users"] });
      toast({ title: "Admin role assigned" });
      setPromoteOpen(false);
      setPromoteUserId("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/admin/users"] });
      toast({ title: "User deleted" });
      setDeleteTarget(null);
      if (selected) setSelected(null);
    },
    onError: (e: Error) => toast({ title: "Delete error", description: e.message, variant: "destructive" }),
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
            <h1 className="text-2xl font-bold tracking-tight">Users</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Manage plans and roles.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
              <Users className="h-3.5 w-3.5" /> {stats.total} total
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <Crown className="h-3.5 w-3.5 text-amber-500" /> {stats.pro} Pro
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <Shield className="h-3.5 w-3.5 text-violet-500" /> {stats.admins} Admin
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setPromoteOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" /> Add Admin
            </Button>
            <Button
              size="sm"
              className="gap-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white border-0"
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${sync.isPending ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-sm"
              placeholder="Search by user ID…"
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
              <SelectItem value="all">All plans</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterRole} onValueChange={(v) => setFilterRole(v as typeof filterRole)}>
            <SelectTrigger className="h-8 text-sm w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="grid grid-cols-[1fr_85px_85px_55px_55px_55px_100px_auto] gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span>User</span><span>Plan</span><span>Role</span>
            <span className="text-center">Inbox</span><span className="text-center">Keys</span><span className="text-center">Domain</span>
            <span>Created</span><span className="text-right">Actions</span>
          </div>

          {isLoading || isFetching && !data ? (
            <div className="flex items-center justify-center py-14 text-muted-foreground gap-2">
              <RefreshCw className="h-5 w-5 animate-spin" /><span className="text-sm">Loading…</span>
            </div>
          ) : !filtered.length ? (
            <div className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-3">
              <Users className="h-10 w-10 opacity-20" />
              <p className="text-sm">{data?.length ? "No users match the current filter." : "No users yet — click \"Refresh\" to import."}</p>
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
                      <span className="font-mono text-xs">{u.id}</span>
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
                        title="Downgrade to Free" disabled={patch.isPending}
                        onClick={() => patch.mutate({ id: u.id, body: { plan: "free" } })}>
                        <ArrowDownCircle className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-amber-500 hover:text-amber-600"
                        title="Upgrade to Pro" disabled={patch.isPending}
                        onClick={() => patch.mutate({ id: u.id, body: { plan: "pro" } })}>
                        <ArrowUpCircle className="h-4 w-4" />
                      </Button>
                    )}
                    {u.role !== "admin" ? (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-violet-500 hover:text-violet-600"
                        title="Set as Admin" disabled={patch.isPending}
                        onClick={() => patch.mutate({ id: u.id, body: { role: "admin" } })}>
                        <Shield className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        title="Remove Admin role" disabled={patch.isPending}
                        onClick={() => patch.mutate({ id: u.id, body: { role: "user" } })}>
                        <ShieldOff className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                      title="Delete user" onClick={() => setDeleteTarget(u)}>
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
            Showing {filtered.length} of {data?.length ?? 0} users
          </p>
        )}
      </div>

      {/* User detail drawer */}
      <UserDetailDrawer
        selected={selected}
        onClose={() => setSelected(null)}
        patch={patch}
        onDelete={(u) => setDeleteTarget(u)}
      />

      {/* Promote by email dialog */}
      <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-violet-500" /> Add Admin by User ID
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Enter the user ID to promote to admin.</p>
            <Input
              placeholder="usr_xxxxxxxxxxxx"
              value={promoteUserId}
              onChange={(e) => setPromoteUserId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && promoteUserId.trim() && promote.mutate(promoteUserId.trim())}
              className="font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPromoteOpen(false)}>Cancel</Button>
            <Button size="sm" className="bg-violet-600 hover:bg-violet-500 text-white border-0"
              disabled={!promoteUserId.trim() || promote.isPending}
              onClick={() => promote.mutate(promoteUserId.trim())}>
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
              <Trash2 className="h-4 w-4" /> Delete user?
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <p className="text-sm">Are you sure you want to delete <strong className="font-mono text-xs">{deleteTarget?.id}</strong>?</p>
            <p className="text-xs text-muted-foreground">This will permanently delete all inboxes, emails, API keys and domains. Cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button size="sm" variant="destructive"
              disabled={deleteUser.isPending}
              onClick={() => deleteTarget && deleteUser.mutate(deleteTarget.id)}>
              {deleteUser.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

// Enhanced user detail drawer with tabbed data view
function UserDetailDrawer({
  selected,
  onClose,
  patch,
  onDelete,
}: {
  selected: AdminUser | null;
  onClose: () => void;
  patch: ReturnType<typeof useMutation<unknown, Error, { id: string; body: Record<string, unknown> }>>;
  onDelete: (u: AdminUser) => void;
}) {
  const { data: detail } = useQuery<UserDetail>({
    queryKey: ["/admin/users/detail", selected?.id],
    queryFn: () => apiFetch<UserDetail>(`/api/admin/users/${selected!.id}/detail`),
    enabled: !!selected,
  });

  return (
    <Sheet open={!!selected} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[420px] sm:w-[520px] overflow-y-auto">
        {selected && (
          <>
            <SheetHeader className="pb-4 border-b">
              <div className="flex items-center gap-3">
                <Avatar user={selected} />
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-base truncate">
                    {detail?.user.displayName ?? selected.id}
                  </SheetTitle>
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
                  <span className="text-muted-foreground">Plan</span>
                  {selected.plan === "pro"
                    ? <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border-0 gap-1"><Crown className="h-3 w-3" />Pro</Badge>
                    : <Badge variant="secondary">Free</Badge>}
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-muted-foreground">Role</span>
                  {selected.role === "admin"
                    ? <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border-0">Admin</Badge>
                    : <Badge variant="outline">User</Badge>}
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-muted-foreground">Created</span>
                  <span className="text-xs">{format(new Date(selected.createdAt), "dd/MM/yyyy HH:mm")}</span>
                </div>
                {detail?.user.lastLoginAt && (
                  <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-muted-foreground">Last Login</span>
                    <span className="text-xs">{formatDistanceToNow(new Date(detail.user.lastLoginAt), { addSuffix: true })}</span>
                  </div>
                )}
                {detail?.user.deletedAt && (
                  <div className="flex items-center justify-between py-2 border-b border-red-200 dark:border-red-900">
                    <span className="text-red-500">Deleted at</span>
                    <span className="text-xs text-red-500">{format(new Date(detail.user.deletedAt), "dd/MM/yyyy HH:mm")}</span>
                  </div>
                )}
              </div>

              {/* Tabbed detail data */}
              {detail && (
                <Tabs defaultValue="inboxes" className="w-full">
                  <TabsList className="w-full grid grid-cols-4 h-8">
                    <TabsTrigger value="inboxes" className="text-xs gap-1">
                      <Inbox className="h-3 w-3" /> {detail.inboxes.length}
                    </TabsTrigger>
                    <TabsTrigger value="emails" className="text-xs gap-1">
                      <Mail className="h-3 w-3" /> {detail.recentEmails.length}
                    </TabsTrigger>
                    <TabsTrigger value="keys" className="text-xs gap-1">
                      <Key className="h-3 w-3" /> {detail.apiKeys.length}
                    </TabsTrigger>
                    <TabsTrigger value="audit" className="text-xs gap-1">
                      <ScrollText className="h-3 w-3" /> {detail.recentAudit.length}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="inboxes" className="mt-3 space-y-2 max-h-[250px] overflow-y-auto">
                    {detail.inboxes.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">No inboxes</p>
                    ) : detail.inboxes.map((inbox) => (
                      <div key={inbox.id} className="bg-muted/40 rounded-lg px-3 py-2 text-xs space-y-1">
                        <div className="font-mono font-medium truncate">{inbox.address}</div>
                        <div className="flex gap-3 text-muted-foreground">
                          <span>{inbox.emailCount} emails</span>
                          <span>Expires: {formatDistanceToNow(new Date(inbox.expiresAt), { addSuffix: true })}</span>
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                  <TabsContent value="emails" className="mt-3 space-y-2 max-h-[250px] overflow-y-auto">
                    {detail.recentEmails.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">No recent emails</p>
                    ) : detail.recentEmails.map((email) => (
                      <div key={email.id} className="bg-muted/40 rounded-lg px-3 py-2 text-xs space-y-1">
                        <div className="font-medium truncate">{email.subject || "(no subject)"}</div>
                        <div className="text-muted-foreground">
                          From: {email.fromAddress} → {email.toAddress}
                        </div>
                        <div className="text-muted-foreground">
                          {formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                  <TabsContent value="keys" className="mt-3 space-y-2 max-h-[250px] overflow-y-auto">
                    {detail.apiKeys.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">No API keys</p>
                    ) : detail.apiKeys.map((key) => (
                      <div key={key.id} className="bg-muted/40 rounded-lg px-3 py-2 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{key.name}</span>
                          <span className="font-mono text-muted-foreground">{key.prefix}...</span>
                        </div>
                        <div className="flex gap-3 text-muted-foreground">
                          {key.revokedAt ? (
                            <span className="text-red-500">Revoked</span>
                          ) : key.lastUsedAt ? (
                            <span>Used {formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true })}</span>
                          ) : (
                            <span>Never used</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                  <TabsContent value="audit" className="mt-3 space-y-2 max-h-[250px] overflow-y-auto">
                    {detail.recentAudit.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">No audit history</p>
                    ) : detail.recentAudit.map((log) => (
                      <div key={log.id} className="bg-muted/40 rounded-lg px-3 py-2 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="text-[10px] h-5">{log.action}</Badge>
                          <span className="text-muted-foreground">{formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}</span>
                        </div>
                        {log.targetType && (
                          <div className="text-muted-foreground">{log.targetType}: {log.targetId}</div>
                        )}
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              )}

              {/* Actions */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  {selected.plan === "pro" ? (
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                      disabled={patch.isPending}
                      onClick={() => patch.mutate({ id: selected.id, body: { plan: "free" } })}>
                      <ArrowDownCircle className="h-3.5 w-3.5" /> Downgrade to Free
                    </Button>
                  ) : (
                    <Button size="sm" className="gap-1.5 text-xs bg-amber-500 hover:bg-amber-400 text-white border-0"
                      disabled={patch.isPending}
                      onClick={() => patch.mutate({ id: selected.id, body: { plan: "pro" } })}>
                      <Crown className="h-3.5 w-3.5" /> Upgrade to Pro
                    </Button>
                  )}
                  {selected.role !== "admin" ? (
                    <Button size="sm" className="gap-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white border-0"
                      disabled={patch.isPending}
                      onClick={() => patch.mutate({ id: selected.id, body: { role: "admin" } })}>
                      <Shield className="h-3.5 w-3.5" /> Set as Admin
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                      disabled={patch.isPending}
                      onClick={() => patch.mutate({ id: selected.id, body: { role: "user" } })}>
                      <ShieldOff className="h-3.5 w-3.5" /> Remove Admin
                    </Button>
                  )}
                </div>
                <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs text-red-500 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30 mt-1"
                  onClick={() => onDelete(selected)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete user & all data
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
