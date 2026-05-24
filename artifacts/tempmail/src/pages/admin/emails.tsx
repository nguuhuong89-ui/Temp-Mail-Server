import { AdminLayout } from "@/components/layout/admin-layout";
import { useListDomains } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Search, Eye, Mail, Paperclip, Trash2, ChevronLeft, ChevronRight, CheckSquare, Square, AlertTriangle } from "lucide-react";
import { useState, useCallback } from "react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type EmailRow = {
  id: number; toAddress: string; fromAddress: string; subject: string;
  preview: string; hasAttachments: boolean; receivedAt: string; domainId: number | null;
};
type EmailsPage = { total: number; page: number; limit: number; emails: EmailRow[] };

const LIMIT = 50;

function buildQuery(params: Record<string, string | number | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") p.set(k, String(v));
  }
  return p.toString();
}

export default function EmailsExplorer() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [domainId, setDomainId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<"selected" | "all">("selected");

  const { data: domains } = useListDomains();

  const queryKey = ["admin-emails-paginated", search, domainId, dateFrom, dateTo, page];
  const { data, isLoading, isFetching } = useQuery<EmailsPage>({
    queryKey,
    queryFn: () => apiFetch<EmailsPage>(`/api/emails/paginated?${buildQuery({
      page, limit: LIMIT,
      search: search || undefined,
      domainId: domainId !== "all" ? domainId : undefined,
      after: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      before: dateTo ? new Date(dateTo + "T23:59:59").toISOString() : undefined,
    })}`),
    placeholderData: (prev) => prev,
  });

  const emails = data?.emails ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const deleteMut = useMutation({
    mutationFn: (body: object) => apiFetch("/api/emails/bulk", { method: "DELETE", body: JSON.stringify(body) }),
    onSuccess: (res: unknown) => {
      const r = res as { deleted: number };
      toast({ title: `Deleted ${r.deleted} email(s)` });
      setSelected(new Set());
      setConfirmOpen(false);
      void qc.invalidateQueries({ queryKey: ["admin-emails-paginated"] });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const toggleSelect = (id: number) => {
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };
  const toggleAll = () => {
    setSelected((prev) => prev.size === emails.length ? new Set() : new Set(emails.map((e) => e.id)));
  };

  const openConfirm = useCallback((mode: "selected" | "all") => {
    setConfirmMode(mode); setConfirmOpen(true);
  }, []);

  const doDelete = () => {
    if (confirmMode === "selected") {
      deleteMut.mutate({ ids: [...selected] });
    } else {
      deleteMut.mutate({
        domainId: domainId !== "all" ? Number(domainId) : undefined,
        search: search || undefined,
        after: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        before: dateTo ? new Date(dateTo + "T23:59:59").toISOString() : undefined,
      });
    }
  };

  const allSelected = emails.length > 0 && selected.size === emails.length;

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">System Emails</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Manage all received emails — total: <strong>{total.toLocaleString()}</strong></p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void qc.invalidateQueries({ queryKey: ["admin-emails-paginated"] })} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search subject, from, to..." className="pl-9" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={domainId} onValueChange={(v) => { setDomainId(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Domain" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Domains</SelectItem>
              {domains?.map((d) => <SelectItem key={d.id} value={d.id.toString()}>@{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">From</span>
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">To</span>
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="text-sm" />
          </div>
        </div>

        {/* Bulk actions bar */}
        {(selected.size > 0 || total > 0) && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
            {selected.size > 0 && (
              <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                Selected <strong>{selected.size}</strong> email(s)
              </span>
            )}
            <div className="flex gap-2 ml-auto">
              {selected.size > 0 && (
                <Button size="sm" variant="destructive" className="h-7 px-3 text-xs gap-1.5"
                  onClick={() => openConfirm("selected")} disabled={deleteMut.isPending}>
                  <Trash2 className="h-3 w-3" /> Delete Selected ({selected.size})
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 px-3 text-xs gap-1.5 border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                onClick={() => openConfirm("all")} disabled={deleteMut.isPending || total === 0}>
                <Trash2 className="h-3 w-3" /> Delete All Results ({total.toLocaleString()})
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="grid grid-cols-[32px_110px_1fr_1fr_1fr_80px] gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <button onClick={toggleAll} className="flex items-center justify-center text-muted-foreground hover:text-foreground">
              {allSelected ? <CheckSquare className="h-4 w-4 text-indigo-500" /> : <Square className="h-4 w-4" />}
            </button>
            <span>Received</span><span>To</span><span>From</span><span>Subject</span>
            <span className="text-right">View</span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" /><span className="text-sm">Loading...</span>
            </div>
          ) : emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Mail className="h-10 w-10 opacity-20" /><p className="text-sm">No emails found.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {emails.map((email) => (
                <div key={email.id}
                  className={`grid grid-cols-[32px_110px_1fr_1fr_1fr_80px] gap-3 items-center px-4 py-3 transition-colors ${selected.has(email.id) ? "bg-indigo-50/80 dark:bg-indigo-950/20" : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"}`}>
                  <button onClick={() => toggleSelect(email.id)} className="flex items-center justify-center text-muted-foreground hover:text-indigo-500">
                    {selected.has(email.id) ? <CheckSquare className="h-4 w-4 text-indigo-500" /> : <Square className="h-4 w-4" />}
                  </button>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}
                  </div>
                  <div className="text-sm truncate text-indigo-700 dark:text-indigo-300 font-medium">{email.toAddress}</div>
                  <div className="text-sm truncate text-muted-foreground">{email.fromAddress}</div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm truncate font-medium">{email.subject || "No Subject"}</span>
                    {email.hasAttachments && <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  </div>
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground">
                      <Link href={`/email/${email.id}`}><Eye className="h-3.5 w-3.5" /> View</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, total)} / {total.toLocaleString()} email
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

      {/* Confirm Delete Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              Confirm Delete
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              {confirmMode === "selected"
                ? <>You will delete <strong className="text-foreground">{selected.size} email(s)</strong> selected.</>
                : <>You will delete <strong className="text-rose-600">{total.toLocaleString()} email(s)</strong> matching the current filter. <strong>This cannot be undone!</strong></>}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmOpen(false)}>Cancel</Button>
              <Button variant="destructive" className="flex-1 gap-1.5" onClick={doDelete} disabled={deleteMut.isPending}>
                {deleteMut.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete Now
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
