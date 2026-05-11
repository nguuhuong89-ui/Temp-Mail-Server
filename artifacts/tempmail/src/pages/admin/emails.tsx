import { AdminLayout } from "@/components/layout/admin-layout";
import { useListAllEmails, useListDomains } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Search, Eye, Mail, Paperclip } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";

export default function EmailsExplorer() {
  const [search, setSearch] = useState("");
  const [domainId, setDomainId] = useState<string>("all");

  const { data: domains } = useListDomains();
  const { data: emails, isLoading } = useListAllEmails({
    search: search || undefined,
    domainId: domainId !== "all" ? Number(domainId) : undefined,
    limit: 50,
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Emails</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Duyệt tất cả email nhận được trên mọi inbox.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm theo subject hoặc địa chỉ..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-[200px]">
            <Select value={domainId} onValueChange={setDomainId}>
              <SelectTrigger>
                <SelectValue placeholder="Lọc theo Domain" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả Domains</SelectItem>
                {domains?.map((d) => (
                  <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[110px_1fr_1fr_1fr_80px] gap-4 px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Nhận</span>
            <span>To</span>
            <span>From</span>
            <span>Subject</span>
            <span className="text-right">Xem</span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span className="text-sm">Đang tải...</span>
            </div>
          ) : !emails?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Mail className="h-10 w-10 opacity-20" />
              <p className="text-sm">Không tìm thấy email.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {emails.map((email) => (
                <div
                  key={email.id}
                  className="grid grid-cols-[110px_1fr_1fr_1fr_80px] gap-4 items-center px-5 py-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}
                  </div>
                  <div className="text-sm truncate text-indigo-700 dark:text-indigo-300 font-medium">
                    {email.toAddress}
                  </div>
                  <div className="text-sm truncate text-muted-foreground">{email.fromAddress}</div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm truncate font-medium">{email.subject || "No Subject"}</span>
                    {email.hasAttachments && <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  </div>
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground">
                      <Link href={`/email/${email.id}`}>
                        <Eye className="h-3.5 w-3.5" /> Xem
                      </Link>
                    </Button>
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
