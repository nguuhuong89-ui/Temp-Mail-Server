import { AdminLayout } from "@/components/layout/admin-layout";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollText, RefreshCw, Search, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

type AuditLog = {
  id: number;
  action: string;
  actorId: string;
  actorEmail: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
};

type AuditResponse = {
  total: number;
  page: number;
  limit: number;
  logs: AuditLog[];
};

const ACTION_COLORS: Record<string, string> = {
  "user.update": "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  "user.delete": "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  "account.self_delete": "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  "settings.update": "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  "purge.anon_emails": "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  "purge.old_emails": "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
};

function getActionColor(action: string) {
  return ACTION_COLORS[action] ?? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300";
}

export default function AdminAuditLogs() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const { data: actions } = useQuery<string[]>({
    queryKey: ["/admin/audit-logs/actions"],
    queryFn: () => apiFetch<string[]>("/api/admin/audit-logs/actions"),
  });

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", "30");
  if (actionFilter !== "all") params.set("action", actionFilter);
  if (search) params.set("actorId", search);

  const { data, isLoading, isFetching } = useQuery<AuditResponse>({
    queryKey: ["/admin/audit-logs", page, actionFilter, search],
    queryFn: () => apiFetch<AuditResponse>(`/api/admin/audit-logs?${params.toString()}`),
  });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ScrollText className="h-6 w-6" /> Audit Logs
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Track all admin actions and system events.
            </p>
          </div>
          {isFetching && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground mt-2" />}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by actor ID..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actions?.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actor</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Target</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Time</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-10"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : !data?.logs.length ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No audit logs found.</td></tr>
                ) : (
                  data.logs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setSelected(log)}
                    >
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className={getActionColor(log.action)}>
                          {log.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono">{log.actorEmail ?? log.actorId.slice(0, 16)}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {log.targetType && <span className="text-xs">{log.targetType}{log.targetId ? `:${log.targetId.slice(0, 12)}` : ""}</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                      </td>
                      <td className="px-4 py-3">
                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.total > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-xs text-muted-foreground">
                {data.total} total log{data.total !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">{page} / {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Sheet */}
        <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
          <SheetContent className="sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <ScrollText className="h-5 w-5" /> Log Detail
              </SheetTitle>
            </SheetHeader>
            {selected && (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Action</div>
                  <Badge variant="secondary" className={getActionColor(selected.action)}>
                    {selected.action}
                  </Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Actor</div>
                  <div className="font-mono text-sm">{selected.actorEmail ?? selected.actorId}</div>
                </div>
                {selected.targetType && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Target</div>
                    <div className="text-sm">{selected.targetType}: {selected.targetId}</div>
                  </div>
                )}
                {selected.ipAddress && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">IP Address</div>
                    <div className="font-mono text-sm">{selected.ipAddress}</div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Time</div>
                  <div className="text-sm">{new Date(selected.createdAt).toLocaleString()}</div>
                </div>
                {selected.metadata && Object.keys(selected.metadata).length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Metadata</div>
                    <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                      {JSON.stringify(selected.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </AdminLayout>
  );
}
