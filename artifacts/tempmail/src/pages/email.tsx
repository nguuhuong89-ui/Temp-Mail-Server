import { PublicLayout } from "@/components/layout/public-layout";
import { useGetEmail, getGetEmailQueryKey } from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Clock, Mail, Paperclip, RefreshCw, Trash2, User, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { AdRenderer } from "@/components/ad-renderer";
import { useDeleteEmail } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useState } from "react";

export default function EmailView() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"html" | "text">("html");

  const { data: email, isLoading } = useGetEmail(Number(id), {
    query: { enabled: !!id, queryKey: getGetEmailQueryKey(Number(id)) },
  });

  const deleteEmail = useDeleteEmail();

  const handleDelete = () => {
    if (!email) return;
    deleteEmail.mutate({ id: email.id }, {
      onSuccess: () => {
        toast({ title: "Đã xoá email" });
        setLocation(`/inbox/${email.toAddress}`);
      },
    });
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `Đã copy ${label}` });
  };

  return (
    <PublicLayout>
      <div className="container max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">

        {/* Ad — top of page */}
        <AdRenderer placement="header" />

        {/* Back navigation */}
        <div>
          <Link
            href={email ? `/inbox/${email.toAddress}` : "/"}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-violet-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại Inbox
          </Link>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-24">
            <RefreshCw className="h-8 w-8 text-violet-400 animate-spin" />
          </div>
        )}

        {/* Not found */}
        {!isLoading && !email && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-3">
            <Mail className="h-12 w-12 opacity-30" />
            <p className="text-lg font-medium">Không tìm thấy email</p>
            <Link href="/" className="text-sm text-violet-400 hover:underline">Về trang chủ</Link>
          </div>
        )}

        {email && (
          <>
            {/* Email header card */}
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-xl border border-white/20 shadow-xl shadow-black/20 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-500" />

              <div className="p-4 sm:p-6 space-y-4">
                {/* Subject + actions */}
                <div className="flex items-start justify-between gap-3">
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-snug flex-1">
                    {email.subject || <span className="italic text-slate-400">(Không có tiêu đề)</span>}
                  </h1>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleteEmail.isPending}
                    className="shrink-0 border-rose-200 dark:border-rose-900/60 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:border-rose-400"
                  >
                    {deleteEmail.isPending
                      ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />}
                    <span className="ml-1.5 hidden sm:inline">Xoá</span>
                  </Button>
                </div>

                {/* Meta rows */}
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-xs font-semibold text-slate-400 uppercase tracking-wide">Từ</span>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <User className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                      <span className="font-mono text-slate-700 dark:text-slate-200 truncate">{email.fromAddress}</span>
                      <button
                        onClick={() => handleCopy(email.fromAddress, "địa chỉ")}
                        className="text-slate-300 hover:text-violet-400 transition-colors shrink-0"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-xs font-semibold text-slate-400 uppercase tracking-wide">Đến</span>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Mail className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                      <span className="font-mono text-slate-700 dark:text-slate-200 truncate">{email.toAddress}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-xs font-semibold text-slate-400 uppercase tracking-wide">Lúc</span>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="text-slate-600 dark:text-slate-300">
                        {new Date(email.receivedAt).toLocaleString("vi-VN")}
                      </span>
                      <span className="text-slate-400 text-xs">
                        ({formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })})
                      </span>
                    </div>
                  </div>
                  {email.hasAttachments && (
                    <div className="flex items-center gap-2">
                      <span className="w-12 shrink-0 text-xs font-semibold text-slate-400 uppercase tracking-wide"></span>
                      <div className="flex items-center gap-1.5 text-amber-500">
                        <Paperclip className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs font-medium">Có tệp đính kèm (chưa hỗ trợ xem)</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* View mode toggle (only show if both html+text exist) */}
                {email.htmlBody && email.textBody && (
                  <div className="flex items-center gap-1 pt-1">
                    <span className="text-xs text-slate-400 mr-2">Xem dạng:</span>
                    <button
                      onClick={() => setViewMode("html")}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${viewMode === "html" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"}`}
                    >
                      HTML
                    </button>
                    <button
                      onClick={() => setViewMode("text")}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${viewMode === "text" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"}`}
                    >
                      Văn bản
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Ad — between header and body */}
            <AdRenderer placement="email_body" />

            {/* Email body */}
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-xl border border-white/20 shadow-xl shadow-black/20 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> Nội dung email
                </span>
                {email.htmlBody && (
                  <a
                    href={`data:text/html;charset=utf-8,${encodeURIComponent(email.htmlBody)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-violet-400 transition-colors"
                    title="Mở trong tab mới"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Mở rộng
                  </a>
                )}
              </div>

              {viewMode === "html" && email.htmlBody ? (
                <iframe
                  title="Email Content"
                  srcDoc={email.htmlBody}
                  sandbox=""
                  className="w-full border-0 bg-white"
                  style={{ height: "560px" }}
                />
              ) : (
                <div className="p-5 sm:p-6">
                  <pre className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words font-mono leading-relaxed">
                    {email.textBody || email.htmlBody?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "Không có nội dung"}
                  </pre>
                </div>
              )}
            </div>

            {/* Ad — below email content */}
            <AdRenderer placement="inbox_top" />
          </>
        )}
      </div>
    </PublicLayout>
  );
}
