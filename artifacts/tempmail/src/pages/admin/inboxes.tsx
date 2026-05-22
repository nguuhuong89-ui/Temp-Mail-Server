import { AdminLayout } from "@/components/layout/admin-layout";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Search, Inbox, Trash2, ChevronLeft, ChevronRight, CheckSquare, Square, AlertTriangle, User, Ghost, Clock } from "lucide-react";
import { useState, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type InboxRow = {
  id: number; address: string; ownerUserId: string | null;
  isAnon: boolean; isExpired: boolean; emailCount: number;
  createdAt: string; expiresAt: string;
};
type InboxPage = { total: number; page: number; limit: number; inboxes: InboxRow[] };

const LIMIT = 50;

function buildQuery(params: Record<string, string | number | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== "all") p.set(k, String(v));
  }
  return p.toString();
}

export default function AdminInboxes() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<"selected" | "expired" | "anon">("selected");

  const queryKey = ["admin-inboxes", search, type, status, page];
  const { data, isLoading, isFetching } = useQuery<InboxPage>({
    queryKey,
    queryFn: () => apiFetch<InboxPage>(`/api/inboxes/list?${buildQuery({
      page, limit: LIMIT, search: search || undefined,
      type: type !== "all" ? type : undefined,
      status: status !== "all" ? status : undefined,
    })}`),
    placeholderData: (prev) => prev,
  });

  const inboxes = data?.inboxes ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const deleteMut = useMutation({
    mutationFn: (body: object) => apiFetch("/api/inboxes/bulk", { method: "DELETE", body: JSON.stringify(body) }),
    onSuccess: (res: unknown) => {
      const r = res as { deleted: number };
      toast({ title: `Đã xóa ${r.deleted} inbox` });
      setSelected(new Set()); setConfirmOpen(false);
      void qc.invalidateQueries({ queryKey: ["admin-inboxes"] });
    },
    onError: () => toast({ title: "Xóa thất bại", variant: "destructive" }),
  });

  const purgeExpiredMut = useMutation({
    mutationFn: () => apiFetch("/api/inboxes/purge-expired", { method: "POST" }),
    onSuccess: (res: unknown) => {
      const r = res as { purged: number };
      toast({ title: `Đã xóa ${r.purged} inbox hết hạn` });
      void qc.invalidateQueries({ queryKey: ["admin-inboxes"] });
    },
    onError: () => toast({ title: "Purge thất bại", variant: "destructive" }),
  });

  const toggleSelect = (addr: string) => {
    setSelected((prev) => { const s = new Set(prev); s.has(addr) ? s.delete(addr) : s.add(addr); return s; });
  };
  const toggleAll = () => {
    setSelected((prev) => prev.size === inboxes.length ? new Set() : new Set(inboxes.map((i) => i.address)));
  };

  const openConfirm = useCallback((mode: "selected" | "expired" | "anon") => {
    setConfirmMode(mode); setConfirmOpen(true);
  }, []);

  const doDelete = () => {
    if (confirmMode === "selected") deleteMut.mutate({ addresses: [...selected] });
    else if (confirmMode === "expired") deleteMut.mutate({ type: "expired" });
    else if (confirmMode === "anon") deleteMut.mutate({ type: "anon" });
  };

  const allSelected = inboxes.length > 0 && selected.size === inboxes.length;

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Inboxes</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Quản lý toàn bộ inbox — tổng: <strong>{total.toLocaleString()}</strong></p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
              onClick={() => openConfirm("expired")} disabled={deleteMut.isPending}>
              <Clock className="h-3.5 w-3.5" /> Xóa hết hạn
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/30"
              onClick={() => openConfirm("anon")} disabled={deleteMut.isPending}>
              <Ghost className="h-3.5 w-3.5" /> Xóa anonymous
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5"
              onClick={() => void qc.invalidateQueries({ queryKey: ["admin-inboxes"] })} disabled={isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Tìm địa chỉ email..." className="pl-9" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Loại inbox" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả loại</SelectItem>
              <SelectItem value="anon">Anonymous (không đăng ký)</SelectItem>
              <SelectItem value="owned">Có chủ (đã đăng nhập)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Trạng thái" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              <SelectItem value="active">Còn hiệu lực</SelectItem>
              <SelectItem value="expired">Đã hết hạn</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
            <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
              Đã chọn <strong>{selected.size}</strong> inbox
            </span>
            <Button size="sm" variant="destructive" className="ml-auto h-7 px-3 text-xs gap-1.5"
              onClick={() => openConfirm("selected")} disabled={deleteMut.isPending}>
              <Trash2 className="h-3 w-3" /> Xóa đã chọn ({selected.size})
            </Button>
          </div>
        )}

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="grid grid-cols-[32px_1fr_80px_80px_120px_80px] gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <button onClick={toggleAll} className="flex items-center justify-center hover:text-foreground">
              {allSelected ? <CheckSquare className="h-4 w-4 text-indigo-500" /> : <Square className="h-4 w-4" />}
            </button>
            <span>Address</span><span>Owner</span><span>Emails</span><span>Hết hạn</span><span>Status</span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" /><span className="text-sm">Đang tải...</span>
            </div>
          ) : inboxes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Inbox className="h-10 w-10 opacity-20" /><p className="text-sm">Không tìm thấy inbox nào.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {inboxes.map((inbox) => (
                <div key={inbox.id}
                  className={`grid grid-cols-[32px_1fr_80px_80px_120px_80px] gap-3 items-center px-4 py-3 transition-colors ${selected.has(inbox.address) ? "bg-indigo-50/80 dark:bg-indigo-950/20" : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"}`}>
                  <button onClick={() => toggleSelect(inbox.address)} className="flex items-center justify-center text-muted-foreground hover:text-indigo-500">
                    {selected.has(inbox.address) ? <CheckSquare className="h-4 w-4 text-indigo-500" /> : <Square className="h-4 w-4" />}
                  </button>
                  <span className="font-mono text-sm truncate">{inbox.address}</span>
                  <div className="flex items-center gap-1">
                    {inbox.isAnon
                      ? <Ghost className="h-3.5 w-3.5 text-slate-400" />
                      : <User className="h-3.5 w-3.5 text-indigo-500" />}
                    <span className="text-xs text-muted-foreground">{inbox.isAnon ? "Anon" : "User"}</span>
                  </div>
                  <span className="text-sm tabular-nums font-medium">{inbox.emailCount}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(inbox.expiresAt), { addSuffix: true })}
                  </span>
                  <Badge className={inbox.isExpired
                    ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border-0 text-xs"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-0 text-xs"}>
                    {inbox.isExpired ? "Expired" : "Active"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, total)} / {total.toLocaleString()}
            </span>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Badge variant="outline" className="px-2.5">{page} / {totalPages}</Badge>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500" /> Xác nhận xóa inbox
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              {confirmMode === "selected" && <>Xóa <strong>{selected.size} inbox</strong> đã chọn và toàn bộ email bên trong.</>}
              {confirmMode === "expired" && <><strong>Xóa tất cả inbox hết hạn</strong> và email của chúng. Không thể hoàn tác!</>}
              {confirmMode === "anon" && <><strong>Xóa tất cả inbox anonymous</strong> (không có chủ sở hữu) và email của chúng. Không thể hoàn tác!</>}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmOpen(false)}>Hủy</Button>
              <Button variant="destructive" className="flex-1 gap-1.5" onClick={doDelete} disabled={deleteMut.isPending}>
                {deleteMut.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Xóa ngay
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
