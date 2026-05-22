import { PublicLayout } from "@/components/layout/public-layout";
import { useGetEmail, getGetEmailQueryKey } from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Clock, Mail, Paperclip, RefreshCw, Trash2, Copy, ExternalLink, ChevronRight, KeyRound, Link2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { AdRenderer } from "@/components/ad-renderer";
import { useDeleteEmail } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useState } from "react";

type QuickItem = { type: "otp"; value: string } | { type: "link"; value: string };

function extractQuickData(text: string): QuickItem[] {
  const results: QuickItem[] = [];
  const ctxOtp = text.match(/(?:code|otp|pin|token|passcode|mã|xác\s*nhận|xác\s*minh|m[aã])[\s:=\-]*([\d]{4,8})\b/i);
  if (ctxOtp?.[1]) {
    results.push({ type: "otp", value: ctxOtp[1] });
  } else {
    const bare = (text.match(/\b\d{4,8}\b/g) ?? []).find((n) => !/^(19|20)\d{2}$/.test(n));
    if (bare) results.push({ type: "otp", value: bare });
  }
  const urls = text.match(/https?:\/\/[^\s"'<>\]\)]+/g) ?? [];
  const link = urls.find((u) => /verif|confirm|activat|reset|click|magic|approv|auth|unsub/i.test(u));
  if (link) results.push({ type: "link", value: link });
  return results;
}

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

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Đã copy" });
  };

  return (
    <PublicLayout>
      <div className="container max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-3">

        <AdRenderer placement="header" />

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
            {/* Compact header card */}
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-xl border border-white/20 shadow-xl shadow-black/20 overflow-hidden">
              <div className="h-0.5 bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-500" />

              {/* Breadcrumb bar */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                <Link
                  href={`/inbox/${email.toAddress}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Quay lại Inbox</span>
                  <span className="hidden sm:inline text-slate-300 dark:text-slate-600 font-mono text-xs">({email.toAddress})</span>
                </Link>
                <div className="flex items-center gap-1">
                  {/* View mode toggle */}
                  {email.htmlBody && email.textBody && (
                    <div className="flex items-center rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden mr-1">
                      <button
                        onClick={() => setViewMode("html")}
                        className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${viewMode === "html" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
                      >
                        HTML
                      </button>
                      <button
                        onClick={() => setViewMode("text")}
                        className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${viewMode === "text" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
                      >
                        Văn bản
                      </button>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDelete}
                    disabled={deleteEmail.isPending}
                    className="h-6 w-6 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    title="Xoá email"
                  >
                    {deleteEmail.isPending
                      ? <RefreshCw className="h-3 w-3 animate-spin" />
                      : <Trash2 className="h-3 w-3" />}
                  </Button>
                </div>
              </div>

              {/* Subject */}
              <div className="px-4 pt-3 pb-2.5">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
                  {email.subject || <span className="italic text-slate-400 font-normal">(Không có tiêu đề)</span>}
                </h1>
              </div>

              {/* Meta row */}
              <div className="px-4 pb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1 min-w-0">
                  <span className="text-slate-400 font-semibold uppercase tracking-wide">Từ</span>
                  <span className="font-mono text-slate-700 dark:text-slate-200 truncate max-w-[180px]">{email.fromAddress}</span>
                  <button onClick={() => handleCopy(email.fromAddress)} className="text-slate-300 hover:text-violet-400 transition-colors ml-0.5" title="Copy">
                    <Copy className="h-2.5 w-2.5" />
                  </button>
                </span>

                <ChevronRight className="h-3 w-3 text-slate-300 hidden sm:block" />

                <span className="flex items-center gap-1 min-w-0">
                  <span className="text-slate-400 font-semibold uppercase tracking-wide">Đến</span>
                  <span className="font-mono text-slate-600 dark:text-slate-300 truncate max-w-[180px]">{email.toAddress}</span>
                </span>

                <span className="flex items-center gap-1 text-slate-400 ml-auto">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>{formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}</span>
                  <span className="hidden sm:inline text-slate-300">·</span>
                  <span className="hidden sm:inline">{new Date(email.receivedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</span>
                </span>

                {email.hasAttachments && (
                  <span className="flex items-center gap-1 text-amber-500">
                    <Paperclip className="h-3 w-3 shrink-0" />
                    <span>Đính kèm</span>
                  </span>
                )}
              </div>
            </div>

            {/* Quick Data Extraction */}
            {(() => {
              const fullText = email.textBody || email.htmlBody?.replace(/<[^>]+>/g, " ") || "";
              const items = extractQuickData(`${email.subject} ${fullText}`);
              if (items.length === 0) return null;
              return (
                <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-xl border border-amber-200 dark:border-amber-800 shadow-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">Trích xuất nhanh</span>
                  </div>
                  <div className="px-4 py-3 flex flex-wrap gap-3">
                    {items.map((item) =>
                      item.type === "otp" ? (
                        <button
                          key="otp"
                          onClick={() => { navigator.clipboard.writeText(item.value); toast({ title: "Đã copy OTP!", description: item.value }); }}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/70 border border-amber-300 dark:border-amber-700 transition-colors group"
                          title="Click để copy OTP"
                        >
                          <KeyRound className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span className="text-lg font-mono font-bold tracking-[0.2em] text-amber-800 dark:text-amber-200">{item.value}</span>
                          <Copy className="h-3.5 w-3.5 text-amber-400 group-hover:text-amber-600 transition-colors" />
                        </button>
                      ) : (
                        <a
                          key="link"
                          href={item.value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 hover:bg-indigo-200 dark:hover:bg-indigo-900/70 border border-indigo-300 dark:border-indigo-700 transition-colors"
                        >
                          <Link2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Mở link xác minh</span>
                          <ExternalLink className="h-3.5 w-3.5 text-indigo-400" />
                        </a>
                      )
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Ad between header and body */}
            <AdRenderer placement="email_body" />

            {/* Email body */}
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-xl border border-white/20 shadow-xl shadow-black/20 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Nội dung email
                </span>
                {email.htmlBody && (
                  <a
                    href={`data:text/html;charset=utf-8,${encodeURIComponent(email.htmlBody)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-violet-400 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" /> Mở rộng
                  </a>
                )}
              </div>

              {viewMode === "html" && email.htmlBody ? (
                <iframe
                  title="Email Content"
                  srcDoc={email.htmlBody}
                  sandbox=""
                  className="w-full border-0 bg-white"
                  style={{ height: "540px" }}
                />
              ) : (
                <div className="p-5">
                  <pre className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words font-mono leading-relaxed">
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
