import { PublicLayout } from "@/components/layout/public-layout";
import { useGetEmail, getGetEmailQueryKey } from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Clock, Mail, Paperclip, RefreshCw, Trash2, User, Copy, ExternalLink, ChevronDown } from "lucide-react";
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
  const [expanded, setExpanded] = useState(false);

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
      <div className="container max-w-4xl mx-auto px-3 sm:px-4 py-3 space-y-2.5">

        <AdRenderer placement="header" />

        {/* Back link */}
        <Link
          href={email ? `/inbox/${email.toAddress}` : "/"}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-violet-400 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Quay lại Inbox
        </Link>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 text-violet-400 animate-spin" />
          </div>
        )}

        {!isLoading && !email && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
            <Mail className="h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">Không tìm thấy email</p>
            <Link href="/" className="text-xs text-violet-400 hover:underline">Về trang chủ</Link>
          </div>
        )}

        {email && (
          <>
            {/* Single combined card */}
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-xl border border-white/20 shadow-xl shadow-black/20 overflow-hidden">
              <div className="h-0.5 bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-500" />

              {/* Subject bar */}
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-snug flex-1 truncate">
                  {email.subject || <span className="italic text-slate-400 font-normal">(Không có tiêu đề)</span>}
                </h1>
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* View toggle — only when both bodies exist */}
                  {email.htmlBody && email.textBody && (
                    <div className="flex items-center rounded overflow-hidden border border-slate-200 dark:border-slate-700 text-[11px] font-semibold">
                      <button
                        onClick={() => setViewMode("html")}
                        className={`px-2 py-0.5 transition-colors ${viewMode === "html" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"}`}
                      >HTML</button>
                      <button
                        onClick={() => setViewMode("text")}
                        className={`px-2 py-0.5 transition-colors ${viewMode === "text" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"}`}
                      >Text</button>
                    </div>
                  )}
                  {email.htmlBody && (
                    <a
                      href={`data:text/html;charset=utf-8,${encodeURIComponent(email.htmlBody)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Mở trong tab mới"
                      className="p-1 text-slate-400 hover:text-violet-400 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button
                    onClick={handleDelete}
                    disabled={deleteEmail.isPending}
                    className="inline-flex items-center gap-1 px-2 h-6 rounded text-[11px] font-semibold border border-rose-200 dark:border-rose-900/60 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-40 transition-colors"
                  >
                    {deleteEmail.isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    Xoá
                  </button>
                </div>
              </div>

              {/* Meta row — all inline */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3 text-violet-400 shrink-0" />
                  <span className="font-semibold text-slate-400 uppercase text-[10px]">Từ</span>
                  <span className="font-mono text-slate-700 dark:text-slate-200 ml-0.5">{email.fromAddress}</span>
                  <button onClick={() => handleCopy(email.fromAddress, "địa chỉ")} className="text-slate-300 hover:text-violet-400 transition-colors ml-0.5">
                    <Copy className="h-2.5 w-2.5" />
                  </button>
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3 text-indigo-400 shrink-0" />
                  <span className="font-semibold text-slate-400 uppercase text-[10px]">Đến</span>
                  <span className="font-mono text-slate-700 dark:text-slate-200 ml-0.5">{email.toAddress}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-300">{new Date(email.receivedAt).toLocaleString("vi-VN")}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-400">{formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}</span>
                </span>
                {email.hasAttachments && (
                  <span className="flex items-center gap-1 text-amber-500">
                    <Paperclip className="h-3 w-3 shrink-0" />
                    <span className="text-[11px] font-medium">Có đính kèm</span>
                  </span>
                )}
              </div>

              {/* Email body */}
              {viewMode === "html" && email.htmlBody ? (
                <div className="relative">
                  <iframe
                    title="Email Content"
                    srcDoc={email.htmlBody}
                    sandbox=""
                    className="w-full border-0 bg-white"
                    style={{ height: expanded ? "100vh" : "480px" }}
                  />
                  <button
                    onClick={() => setExpanded((v) => !v)}
                    className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1 py-1.5 bg-gradient-to-t from-white/90 to-transparent dark:from-slate-900/90 text-xs text-slate-400 hover:text-violet-400 transition-colors"
                  >
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
                    {expanded ? "Thu gọn" : "Mở rộng"}
                  </button>
                </div>
              ) : (
                <div className="p-3 sm:p-4">
                  <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words font-mono leading-relaxed">
                    {email.textBody || email.htmlBody?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "Không có nội dung"}
                  </pre>
                </div>
              )}
            </div>

            <AdRenderer placement="inbox_top" />
          </>
        )}
      </div>
    </PublicLayout>
  );
}
