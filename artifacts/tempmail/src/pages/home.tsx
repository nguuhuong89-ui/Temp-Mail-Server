import { PublicLayout } from "@/components/layout/public-layout";
import { Show } from "@clerk/react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useInboxStream } from "@/hooks/use-inbox-stream";
import {
  useCreateRandomInbox,
  useCreateCustomInbox,
  useGetInbox,
  useExtendInbox,
  useDeleteInboxEmail,
  useClearInboxEmails,
  useListPublicDomains,
  generateTotp,
  getGetInboxQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Mail, Copy, Trash2, ChevronLeft, ChevronRight, Paperclip, ExternalLink, Search, Wand2, AtSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdRenderer } from "@/components/ad-renderer";
import { Link, useParams, useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-fetch";
import { useQuery } from "@tanstack/react-query";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function AddDomainDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: me } = useQuery({
    queryKey: ["/account/me"],
    queryFn: () => apiFetch<{ plan: string }>("/api/account/me"),
    retry: false,
  });
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (!open) return;
    if (me && me.plan === "pro") {
      onClose();
      setLocation("/account/domains");
    }
  }, [open, me, onClose, setLocation]);
  if (!open) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm custom domain</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1 text-sm text-muted-foreground">
          {me && me.plan !== "pro" ? (
            <>
              <p>Thêm domain riêng là tính năng <strong>Pro</strong>.</p>
              <Button asChild className="w-full"><Link href="/account/plan">Nâng cấp Pro</Link></Button>
            </>
          ) : (
            <p>Đang chuyển hướng…</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Home() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const [localAddress, setLocalAddress] = useLocalStorage<string | null>("tempmail_address", null);
  const address = params.address || localAddress;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: inbox, isLoading } = useGetInbox(address || "", {
    query: { enabled: !!address, queryKey: getGetInboxQueryKey(address || "") },
  });
  const { data: publicDomains } = useListPublicDomains();
  const createRandom = useCreateRandomInbox();
  const createCustom = useCreateCustomInbox();
  const extend = useExtendInbox();
  const deleteEmail = useDeleteInboxEmail();
  const clearEmails = useClearInboxEmails();

  const [selectedDomainId, setSelectedDomainId] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Check inbox by email
  const [checkEmailInput, setCheckEmailInput] = useState("");

  // Custom inbox dialog
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customUsername, setCustomUsername] = useState("");
  const [customDomainId, setCustomDomainId] = useState<string>("");

  // 2FA state
  const [totpSecret, setTotpSecret] = useState("");
  const [totpCode, setTotpCode] = useState<string | null>(null);
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpRemaining, setTotpRemaining] = useState(0);
  const [totpPeriod, setTotpPeriod] = useState(30);
  const [totpActiveSecret, setTotpActiveSecret] = useState<string | null>(null);
  const totpReqRef = useRef(0);
  const totpTickRef = useRef<number | null>(null);

  // Add domain dialog
  const [addDomainOpen, setAddDomainOpen] = useState(false);

  useInboxStream(address || undefined);

  useEffect(() => {
    if (params.address && params.address !== localAddress) {
      setLocalAddress(params.address);
    }
  }, [params.address, localAddress, setLocalAddress]);

  // Reset page when inbox changes
  useEffect(() => { setPage(1); }, [address]);

  // Auto-select first domain when list loads
  useEffect(() => {
    if (publicDomains && publicDomains.length > 0 && !customDomainId) {
      setCustomDomainId(String(publicDomains[0].id));
    }
  }, [publicDomains, customDomainId]);

  const handleGenerate = () => {
    const domainId = selectedDomainId ? parseInt(selectedDomainId, 10) : undefined;
    createRandom.mutate(
      { data: domainId ? { domainId } : {} },
      {
        onSuccess: (data) => {
          setLocalAddress(data.address);
          window.history.pushState({}, "", `/inbox/${data.address}`);
        },
      },
    );
  };

  const handleCheckEmail = () => {
    const trimmed = checkEmailInput.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      toast({ title: "Địa chỉ email không hợp lệ", variant: "destructive" });
      return;
    }
    setLocalAddress(trimmed);
    setLocation(`/inbox/${trimmed}`);
    setCheckEmailInput("");
  };

  const handleCreateCustom = () => {
    const username = customUsername.trim().toLowerCase();
    if (!username || !customDomainId) {
      toast({ title: "Vui lòng nhập username và chọn domain", variant: "destructive" });
      return;
    }
    createCustom.mutate(
      { data: { localPart: username, domainId: parseInt(customDomainId, 10) } },
      {
        onSuccess: (data) => {
          setLocalAddress(data.address);
          window.history.pushState({}, "", `/inbox/${data.address}`);
          setCustomDialogOpen(false);
          setCustomUsername("");
          toast({ title: "Đã tạo inbox tùy chỉnh", description: data.address });
        },
        onError: (e: Error) => {
          toast({ title: "Tạo inbox thất bại", description: e.message, variant: "destructive" });
        },
      },
    );
  };

  // Derived: selected domain name for preview
  const customDomain = publicDomains?.find((d) => String(d.id) === customDomainId);
  const customPreview = customUsername && customDomain
    ? `${customUsername.trim().toLowerCase()}@${customDomain.name}`
    : null;

  const handleCopyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    toast({ title: "Đã copy địa chỉ email" });
  };

  const handleCopyUrl = () => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}inbox/${address}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Đã copy URL" });
  };

  const handleDeleteAll = () => {
    if (!address) return;
    clearEmails.mutate(
      { address },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey(address) });
          toast({ title: "Đã xoá tất cả email" });
          setPage(1);
        },
      },
    );
  };

  const handleDeleteEmail = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!address) return;
    deleteEmail.mutate(
      { address, id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey(address) });
          toast({ title: "Đã xoá email" });
        },
      },
    );
  };

  const handleExtend = () => {
    if (!address) return;
    extend.mutate({ address }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey(address) });
        toast({ title: "Đã gia hạn thêm 10 phút" });
      },
    });
  };

  // TOTP helpers
  const fetchTotp = async (s: string) => {
    const trimmed = s.trim();
    if (!trimmed) return;
    const id = ++totpReqRef.current;
    setTotpLoading(true);
    try {
      const res = await generateTotp({ secret: trimmed });
      if (id !== totpReqRef.current) return;
      setTotpCode(res.code);
      setTotpPeriod(res.period);
      setTotpRemaining(res.remainingSeconds);
      setTotpActiveSecret(trimmed);
    } catch {
      if (id !== totpReqRef.current) return;
      toast({ title: "Secret 2FA không hợp lệ", variant: "destructive" });
    } finally {
      if (id === totpReqRef.current) setTotpLoading(false);
    }
  };

  useEffect(() => {
    if (!totpCode || !totpActiveSecret) return;
    if (totpTickRef.current) window.clearInterval(totpTickRef.current);
    totpTickRef.current = window.setInterval(() => {
      setTotpRemaining((r) => {
        if (r <= 1) { void fetchTotp(totpActiveSecret); return totpPeriod; }
        return r - 1;
      });
    }, 1000);
    return () => { if (totpTickRef.current) window.clearInterval(totpTickRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totpCode, totpPeriod, totpActiveSecret]);

  const handleCopyTotp = () => {
    if (!totpCode) return;
    navigator.clipboard.writeText(totpCode);
    toast({ title: "Đã copy mã 2FA", description: totpCode });
  };

  // Pagination
  const allEmails = inbox?.emails ?? [];
  const totalEmails = allEmails.length;
  const totalPages = Math.max(1, Math.ceil(totalEmails / pageSize));
  const pagedEmails = allEmails.slice((page - 1) * pageSize, page * pageSize);
  const showingFrom = totalEmails === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, totalEmails);

  const shareUrl = address ? `${window.location.origin}${import.meta.env.BASE_URL}inbox/${address}` : "";
  const isOnline = !!inbox;

  return (
    <PublicLayout>
      <div className="container max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4">
        <AdRenderer placement="header" />

        {/* Main card */}
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-xl border border-white/20 shadow-2xl shadow-black/30 overflow-hidden">
          {/* Accent top bar */}
          <div className="h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-500" />

          {/* Email row */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-700/60 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <label className="text-sm font-semibold shrink-0 sm:w-14 text-slate-600 dark:text-slate-400">Email:</label>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 px-3 py-2 border border-indigo-200 dark:border-indigo-900/60 rounded-lg text-sm font-mono bg-indigo-50/50 dark:bg-indigo-950/30 truncate select-all text-slate-800 dark:text-slate-100">
                  {address || <span className="text-slate-400 dark:text-slate-500 italic">— chưa có inbox —</span>}
                </div>
                {address && (
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-full tracking-wide shrink-0 ${isOnline ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-500/20 text-slate-400 border border-slate-500/30"}`}>
                    {isOnline ? "● Online" : "○ Offline"}
                  </span>
                )}
              </div>
            </div>

            {address && (
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className="font-semibold text-violet-600 dark:text-violet-400 shrink-0">URL Email:</span>
                <a
                  href={shareUrl}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline break-all font-mono text-xs"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {shareUrl}
                </a>
                <button onClick={handleCopyUrl} className="text-slate-400 hover:text-violet-500 shrink-0 transition-colors">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="bg-amber-400 hover:bg-amber-300 text-amber-950 border-0 shadow-sm shadow-amber-400/30 font-semibold"
                onClick={handleCopyAddress}
                disabled={!address}
              >
                <Copy className="h-3.5 w-3.5 mr-1" /> Copy Email
              </Button>
              <Button
                size="sm"
                className="bg-sky-500 hover:bg-sky-400 text-white border-0 shadow-sm shadow-sky-500/30 font-semibold"
                onClick={() => address && queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey(address) })}
                disabled={!address || isLoading}
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLoading ? "animate-spin" : ""}`} /> Check Inbox
              </Button>
              <Button
                size="sm"
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-0 shadow-sm shadow-violet-500/30 font-semibold"
                onClick={handleGenerate}
                disabled={createRandom.isPending}
              >
                {createRandom.isPending
                  ? <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
                  : <Mail className="h-3.5 w-3.5 mr-1" />}
                Generate New Email
              </Button>
              <Button
                size="sm"
                className="bg-emerald-500 hover:bg-emerald-400 text-white border-0 shadow-sm shadow-emerald-500/30 font-semibold"
                onClick={() => {
                  if (publicDomains && publicDomains.length > 0 && !customDomainId) {
                    setCustomDomainId(String(publicDomains[0].id));
                  }
                  setCustomDialogOpen(true);
                }}
              >
                <Wand2 className="h-3.5 w-3.5 mr-1" /> Tạo Inbox Tùy Chỉnh
              </Button>
              <Button
                size="sm"
                className="bg-rose-500 hover:bg-rose-400 text-white border-0 shadow-sm shadow-rose-500/30 font-semibold"
                onClick={handleDeleteAll}
                disabled={!address || clearEmails.isPending || totalEmails === 0}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete All Mail
              </Button>
              {address && (
                <Button size="sm" variant="outline" onClick={handleExtend} disabled={extend.isPending} className="border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${extend.isPending ? "animate-spin" : ""}`} /> +10 phút
                </Button>
              )}
            </div>

            {/* Check inbox by email address */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-sm font-semibold shrink-0 text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Search className="h-3.5 w-3.5" /> Xem inbox:
              </span>
              <div className="flex-1 flex gap-2">
                <Input
                  value={checkEmailInput}
                  onChange={(e) => setCheckEmailInput(e.target.value)}
                  placeholder="nhập email bất kỳ, vd: alice@tempmail.local"
                  className="flex-1 h-8 text-sm font-mono border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus-visible:ring-violet-500"
                  onKeyDown={(e) => { if (e.key === "Enter") handleCheckEmail(); }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                  onClick={handleCheckEmail}
                  disabled={!checkEmailInput.trim()}
                >
                  <Search className="h-3.5 w-3.5 mr-1" /> Xem
                </Button>
              </div>
            </div>

            {/* Inbox label row: 2FA + custom domain */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              <span className="font-bold text-base shrink-0 text-violet-700 dark:text-violet-400">Inbox:</span>
              <div className="flex-1 flex flex-wrap items-center gap-2">
                <Input
                  value={totpSecret}
                  onChange={(e) => setTotpSecret(e.target.value)}
                  placeholder="2FA key (base32 hoặc otpauth://...)"
                  className="flex-1 min-w-0 h-8 text-sm font-mono border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20 focus-visible:ring-violet-500"
                  onKeyDown={(e) => { if (e.key === "Enter") void fetchTotp(totpSecret); }}
                />
                {totpCode ? (
                  <button
                    onClick={handleCopyTotp}
                    className="flex items-center gap-1 px-3 h-8 text-sm font-mono font-bold bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg hover:from-violet-500 hover:to-indigo-500 transition-all shrink-0 shadow-sm shadow-violet-500/30"
                    title={`${totpRemaining}s`}
                  >
                    {totpCode} <Copy className="h-3 w-3 ml-1" />
                  </button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                    onClick={() => void fetchTotp(totpSecret)}
                    disabled={totpLoading || !totpSecret.trim()}
                  >
                    {totpLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Copy 2FA code"}
                  </Button>
                )}
                <Show when="signed-in">
                  <button
                    onClick={() => setAddDomainOpen(true)}
                    className="flex items-center gap-1 px-3 h-8 text-sm bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors shrink-0"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Add Domain
                  </button>
                </Show>
                <Show when="signed-out">
                  <Link href="/sign-in">
                    <button className="flex items-center gap-1 px-3 h-8 text-sm bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors">
                      <ExternalLink className="h-3.5 w-3.5" /> Add Domain
                    </button>
                  </Link>
                </Show>
              </div>
            </div>
          </div>

          {/* Pagination bar */}
          <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-indigo-50/40 dark:bg-indigo-950/20 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-600 dark:text-slate-400">Show:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="px-2 py-0.5 border border-indigo-200 dark:border-indigo-900/60 rounded-md text-sm bg-white dark:bg-slate-800"
              >
                {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="text-slate-600 dark:text-slate-400">emails per page</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-500 dark:text-slate-400 text-xs">
                {totalEmails === 0 ? "No emails" : `Showing ${showingFrom}–${showingTo} of ${totalEmails} emails`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-2 py-0.5 border border-slate-300 dark:border-slate-600 rounded-md text-sm disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="px-2.5 py-0.5 rounded-md text-sm bg-gradient-to-r from-violet-600 to-indigo-600 text-white min-w-[2rem] text-center font-semibold">{page}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-2 py-0.5 border border-slate-300 dark:border-slate-600 rounded-md text-sm disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Email table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-indigo-700 to-violet-700 text-white">
                  <th className="text-left px-4 py-2.5 font-semibold uppercase text-xs tracking-wider w-1/4">Sender</th>
                  <th className="text-left px-4 py-2.5 font-semibold uppercase text-xs tracking-wider">Subject</th>
                  <th className="text-left px-4 py-2.5 font-semibold uppercase text-xs tracking-wider w-36 hidden sm:table-cell">Date</th>
                  <th className="text-left px-4 py-2.5 font-semibold uppercase text-xs tracking-wider w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && address ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-400">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : !address ? (
                  <tr>
                    <td colSpan={4} className="text-center py-10 text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <Mail className="h-8 w-8 text-indigo-300 dark:text-indigo-600" />
                        <span>Bấm <span className="text-violet-600 dark:text-violet-400 font-medium">"Generate New Email"</span> để tạo inbox.</span>
                      </div>
                    </td>
                  </tr>
                ) : pagedEmails.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-400">
                      No emails found
                    </td>
                  </tr>
                ) : (
                  pagedEmails.map((email, i) => (
                    <tr
                      key={email.id}
                      className={`border-b border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 transition-colors ${i % 2 === 0 ? "" : "bg-slate-50/60 dark:bg-slate-800/20"}`}
                      onClick={() => setLocation(`/email/${email.id}`)}
                    >
                      <td className="px-4 py-2.5 truncate max-w-0 font-medium text-indigo-700 dark:text-indigo-300">
                        <span className="truncate block">{email.fromAddress}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{email.subject || "(No Subject)"}</span>
                          {email.hasAttachments && <Paperclip className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-xs hidden sm:table-cell whitespace-nowrap">
                        {formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={(e) => handleDeleteEmail(e, email.id)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                          aria-label="Xoá email"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Important Notice */}
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded-xl border border-white/20 shadow-lg shadow-black/20 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-violet-500 to-indigo-500" />
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">Important Notice</h3>
          </div>
          <ul className="space-y-1.5 text-sm text-slate-500 dark:text-slate-400 list-disc pl-5">
            <li>Chúng tôi không quản lý trực tiếp các domain. Chúng được kiểm soát bởi chủ sở hữu, người có thể thêm/xóa bất kỳ lúc nào.</li>
            <li>Nếu email của bạn offline, domain đó đã bị gỡ. Chúng tôi không thể khôi phục.</li>
            <li>Dịch vụ này chỉ <strong className="text-slate-700 dark:text-slate-300">nhận</strong> email tạm thời.</li>
            <li>Gửi email, bulk mailing, hay SMTP relay <strong className="text-slate-700 dark:text-slate-300">không được hỗ trợ</strong>.</li>
            <li>Chỉ dùng để test, bảo vệ quyền riêng tư, tránh spam.</li>
            <li>Lạm dụng, gian lận, phishing hoặc tạo tài khoản hàng loạt là <strong className="text-rose-600 dark:text-rose-400">vi phạm</strong>.</li>
          </ul>
        </div>

        <AdRenderer placement="inbox_top" />
      </div>

      <AddDomainDialog open={addDomainOpen} onClose={() => setAddDomainOpen(false)} />

      {/* Custom Inbox Dialog */}
      <Dialog open={customDialogOpen} onOpenChange={(o) => { setCustomDialogOpen(o); if (!o) setCustomUsername(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AtSign className="h-5 w-5 text-violet-500" />
              Tạo Inbox Tùy Chỉnh
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Chọn username và domain để tạo địa chỉ email riêng của bạn.
            </p>
            <div className="space-y-2">
              <Label>Username</Label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="vd: alice, myname, test123"
                  value={customUsername}
                  onChange={(e) => setCustomUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._+-]/g, ""))}
                  className="flex-1 font-mono"
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateCustom(); }}
                  autoFocus
                />
                <span className="text-muted-foreground font-medium shrink-0">@</span>
              </div>
              <p className="text-xs text-muted-foreground">Chỉ chứa chữ thường, số, dấu chấm, gạch dưới.</p>
            </div>
            <div className="space-y-2">
              <Label>Domain</Label>
              {publicDomains && publicDomains.length > 0 ? (
                <Select value={customDomainId} onValueChange={setCustomDomainId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn domain…" />
                  </SelectTrigger>
                  <SelectContent>
                    {publicDomains.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        @{d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground italic">Chưa có domain public nào.</p>
              )}
            </div>
            {customPreview && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
                <Mail className="h-4 w-4 text-violet-500 shrink-0" />
                <span className="font-mono text-sm font-semibold text-violet-700 dark:text-violet-300 break-all">
                  {customPreview}
                </span>
              </div>
            )}
            <Button
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0 font-semibold"
              onClick={handleCreateCustom}
              disabled={createCustom.isPending || !customUsername.trim() || !customDomainId}
            >
              {createCustom.isPending
                ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Đang tạo...</>
                : <><Wand2 className="h-4 w-4 mr-2" /> Tạo inbox</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PublicLayout>
  );
}
