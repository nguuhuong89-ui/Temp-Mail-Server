import { PublicLayout } from "@/components/layout/public-layout";
import { Trans, useTranslation } from "react-i18next";

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
import { RefreshCw, Mail, Copy, Trash2, ChevronLeft, ChevronRight, Paperclip, ExternalLink, Search, Wand2, AtSign, Bookmark, BookmarkCheck, Play, Pin, X, History, KeyRound, Link2, Timer, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdRenderer } from "@/components/ad-renderer";
import { Link, useParams, useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-fetch";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/lib/auth-context";

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const AUTO_ROTATE_MS = 10 * 60 * 1000;

type QuickItem = { type: "otp"; value: string } | { type: "link"; value: string };
function extractQuickData(text: string): QuickItem[] {
  const results: QuickItem[] = [];
  const ctxOtp = text.match(/(?:code|otp|pin|token|passcode|m[aã]|xác)[\s:=\-]*(\d{4,8})\b/i);
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
const AD_DURATION = 5;

function AdWallModal({ open, onComplete, onClose }: { open: boolean; onComplete: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState(AD_DURATION);
  const [done, setDone] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) { setCountdown(AD_DURATION); setDone(false); return; }
    setCountdown(AD_DURATION);
    setDone(false);
    timerRef.current = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          window.clearInterval(timerRef.current!);
          setDone(true);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Play className="h-4 w-4 text-amber-500" />
            {t("home.adTitle")}
          </DialogTitle>
        </DialogHeader>

        {/* Fake ad banner */}
        <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
          <div className="px-4 py-6 text-center space-y-2">
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight">🔥 FLASH SALE</div>
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t("home.adFlashSale")}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{t("home.adLimitedOffer")}</div>
            <div className="mt-3 inline-block px-4 py-1.5 rounded-full bg-amber-500 text-white text-xs font-bold shadow-md shadow-amber-400/40">
              {t("home.adBuyNow")}
            </div>
          </div>
          {/* Countdown badge */}
          {!done && (
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/70 text-white text-xs font-mono font-bold">
              {countdown}s
            </div>
          )}
        </div>

        <p className="text-xs text-center text-slate-400 dark:text-slate-500">
          {t("home.adSupportMsg")}
        </p>

        <Button
          className={`w-full font-semibold transition-all ${done ? "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0 shadow-md shadow-violet-500/30" : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"}`}
          disabled={!done}
          onClick={() => { onComplete(); onClose(); }}
        >
          {done ? t("home.adDone") : t("home.adSkipAfter", { s: countdown })}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function AddDomainDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
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
          <DialogTitle>{t("home.addDomainTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1 text-sm text-muted-foreground">
          {me && me.plan !== "pro" ? (
            <>
              <p>{t("home.addDomainProFeature")}</p>
              <Button asChild className="w-full"><Link href="/account/plan">{t("home.upgradePro")}</Link></Button>
            </>
          ) : (
            <p>{t("home.redirecting")}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const params = useParams();
  const [, setLocation] = useLocation();
  const [localAddress, setLocalAddress] = useLocalStorage<string | null>("tempmail_address", null);
  const address = params.address || localAddress;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isSignedIn } = useUser();

  const { data: inbox, isLoading, isFetching } = useGetInbox(address || "", {
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

  // Editable email field — mirrors address, but user can type a new one
  const [emailInputValue, setEmailInputValue] = useState(address || "");

  // Custom inbox dialog
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customUsername, setCustomUsername] = useState("");
  const [customDomainId, setCustomDomainId] = useState<string>("");

  // Auto-rotate timer
  const lastAddressChangedAt = useRef(Date.now());
  const [autoRotateCountdown, setAutoRotateCountdown] = useState<number | null>(null);

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

  // Ad wall
  const [adWallOpen, setAdWallOpen] = useState(false);
  const adPendingAction = useRef<(() => void) | null>(null);
  const openAdWall = useCallback((action: () => void) => {
    adPendingAction.current = action;
    setAdWallOpen(true);
  }, []);

  // Saved emails (localStorage)
  const [savedEmails, setSavedEmails] = useLocalStorage<string[]>("tempmail_saved", []);
  const isSaved = !!(address && savedEmails.includes(address));

  useInboxStream(address || undefined);

  useEffect(() => {
    if (params.address && params.address !== localAddress) {
      setLocalAddress(params.address);
    }
  }, [params.address, localAddress, setLocalAddress]);

  // Reset page when inbox changes
  useEffect(() => { setPage(1); }, [address]);

  // Reset auto-rotate timer when address changes
  useEffect(() => {
    if (address) { lastAddressChangedAt.current = Date.now(); setAutoRotateCountdown(null); }
  }, [address]);

  // Check every 30s whether 10 minutes have passed on same inbox
  useEffect(() => {
    if (!address) return;
    const iv = setInterval(() => {
      if (Date.now() - lastAddressChangedAt.current >= AUTO_ROTATE_MS) {
        setAutoRotateCountdown((c) => (c === null ? 5 : c));
      }
    }, 30_000);
    return () => clearInterval(iv);
  }, [address]);

  // Countdown tick → auto-generate when reaches 0
  useEffect(() => {
    if (autoRotateCountdown === null) return;
    if (autoRotateCountdown <= 0) {
      setAutoRotateCountdown(null);
      createRandom.mutate(
        { data: {} },
        {
          onSuccess: (data) => {
            setLocalAddress(data.address);
            window.history.pushState({}, "", `/inbox/${data.address}`);
            autoSave(data.address);
            toast({ title: t("home.autoRotatedToast"), description: data.address });
          },
        },
      );
      return;
    }
    const timer = setTimeout(() => setAutoRotateCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(timer);
  }, [autoRotateCountdown]);

  // Auto-create email for new visitors (no address stored)
  const autoCreatedRef = useRef(false);
  useEffect(() => {
    if (!address && !autoCreatedRef.current && !createRandom.isPending) {
      autoCreatedRef.current = true;
      createRandom.mutate(
        { data: {} },
        {
          onSuccess: (data) => {
            setLocalAddress(data.address);
            window.history.pushState({}, "", `/inbox/${data.address}`);
          },
        },
      );
    }
  }, [address]);

  // Keep email input in sync when address changes (generate/custom/navigate)
  useEffect(() => { setEmailInputValue(address || ""); }, [address]);

  // Auto-select first domain when list loads
  useEffect(() => {
    if (Array.isArray(publicDomains) && publicDomains.length > 0 && !customDomainId) {
      setCustomDomainId(String(publicDomains[0].id));
    }
  }, [publicDomains, customDomainId]);

  const autoSave = useCallback((addr: string) => {
    if (!isSignedIn) return;
    setSavedEmails((prev) => [addr, ...prev.filter((e) => e !== addr)].slice(0, 20));
  }, [setSavedEmails, isSignedIn]);

  const handleGenerate = () => {
    const domainId = selectedDomainId ? parseInt(selectedDomainId, 10) : undefined;
    createRandom.mutate(
      { data: domainId ? { domainId } : {} },
      {
        onSuccess: (data) => {
          setLocalAddress(data.address);
          window.history.pushState({}, "", `/inbox/${data.address}`);
          autoSave(data.address);
        },
      },
    );
  };

  // Resolve selected domain name
  const selectedDomain = Array.isArray(publicDomains) ? publicDomains.find((d) => String(d.id) === selectedDomainId) : undefined;

  const handleCheckEmail = () => {
    const trimmed = emailInputValue.trim().toLowerCase();
    // When a domain is selected, treat input as username and create custom inbox
    if (selectedDomainId && selectedDomain && trimmed && !trimmed.includes("@")) {
      createCustom.mutate(
        { data: { localPart: trimmed, domainId: parseInt(selectedDomainId, 10) } },
        {
          onSuccess: (data) => {
            setLocalAddress(data.address);
            setEmailInputValue(data.address);
            window.history.pushState({}, "", `/inbox/${data.address}`);
            autoSave(data.address);
            toast({ title: t("home.customInboxTitle"), description: data.address });
          },
          onError: (e: Error) => {
            toast({ title: t("home.customCreateError"), description: e.message, variant: "destructive" });
          },
        },
      );
      return;
    }
    if (!trimmed || !trimmed.includes("@")) {
      toast({ title: t("home.invalidEmail"), variant: "destructive" });
      return;
    }
    if (trimmed === address) {
      void queryClient.refetchQueries({ queryKey: getGetInboxQueryKey(trimmed) });
      return;
    }
    queryClient.removeQueries({ queryKey: getGetInboxQueryKey(trimmed) });
    setLocalAddress(trimmed);
    setLocation(`/inbox/${trimmed}`);
  };

  const handleCreateCustom = () => {
    const username = customUsername.trim().toLowerCase();
    if (!username || !customDomainId) {
      toast({ title: t("home.customLocalPart"), variant: "destructive" });
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
          autoSave(data.address);
          toast({ title: t("home.customInboxTitle"), description: data.address });
        },
        onError: (e: Error) => {
          toast({ title: t("home.customCreateError"), description: e.message, variant: "destructive" });
        },
      },
    );
  };

  // Derived: selected domain name for preview
  const customDomain = Array.isArray(publicDomains) ? publicDomains.find((d) => String(d.id) === customDomainId) : undefined;
  const customPreview = customUsername && customDomain
    ? `${customUsername.trim().toLowerCase()}@${customDomain.name}`
    : null;

  const handleCopyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    toast({ title: t("home.copiedToast") });
  };

  const handleCopyUrl = () => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}inbox/${address}`;
    navigator.clipboard.writeText(url);
    toast({ title: t("home.copiedToast") });
  };

  const handleDeleteAll = () => {
    if (!address) return;
    clearEmails.mutate(
      { address },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey(address) });
          toast({ title: t("home.allDeleted") });
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
          toast({ title: t("home.emailDeleted") });
        },
      },
    );
  };

  const doExtend = useCallback(() => {
    if (!address) return;
    extend.mutate({ address }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey(address) });
        toast({ title: t("home.extendedToast") });
      },
    });
  }, [address, extend, queryClient, toast]);

  const handleExtend = () => {
    if (!address) return;
    openAdWall(doExtend);
  };

  const saveToServer = useMutation({
    mutationFn: (addr: string) => apiFetch("/api/account/saved-inboxes", { method: "POST", body: JSON.stringify({ address: addr }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/account/saved-inboxes"] }); },
  });

  const handleSaveEmail = () => {
    if (!address) return;
    if (isSaved) {
      setSavedEmails(savedEmails.filter((e) => e !== address));
      toast({ title: t("home.unsavedToast") });
      return;
    }
    const doSave = () => {
      setSavedEmails([address, ...savedEmails.filter((e) => e !== address)]);
      if (isSignedIn) saveToServer.mutate(address);
      toast({ title: t("home.savedToast"), description: address });
    };
    if (isSignedIn) {
      doSave();
    } else {
      openAdWall(doSave);
    }
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
      toast({ title: t("home.invalidSecret"), variant: "destructive" });
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
    toast({ title: t("home.twoFaCopied"), description: totpCode });
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

        {/* Auto-rotate countdown banner */}
        {autoRotateCountdown !== null && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 shadow-md">
            <Timer className="h-5 w-5 text-amber-500 shrink-0 animate-pulse" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">{t("home.autoRotateBanner")} </span>
              <span className="text-sm text-amber-700 dark:text-amber-300">{t("home.autoRotateSuffix")} <strong className="font-mono text-base">{autoRotateCountdown}s</strong></span>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => { setAutoRotateCountdown(null); lastAddressChangedAt.current = Date.now(); }}
                className="text-xs px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 font-medium transition-colors"
              >
                {t("home.keepIt")}
              </button>
              <button
                onClick={() => { setAutoRotateCountdown(0); }}
                className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-white font-medium transition-colors flex items-center gap-1"
              >
                <Zap className="h-3 w-3" /> {t("home.createNow")}
              </button>
            </div>
          </div>
        )}

        {/* Main card */}
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-xl border border-white/20 shadow-2xl shadow-black/30 overflow-hidden">
          {/* Accent top bar */}
          <div className="h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-500" />

          {/* Email row */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-700/60 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <label className="text-sm font-semibold shrink-0 sm:w-14 text-slate-600 dark:text-slate-400">Email:</label>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 flex items-center gap-0">
                  <input
                    type="text"
                    value={emailInputValue}
                    onChange={(e) => setEmailInputValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCheckEmail(); }}
                    placeholder={selectedDomainId ? t("home.usernamePlaceholder") : t("home.emailPlaceholder")}
                    className={`flex-1 px-3 py-2 border border-indigo-200 dark:border-indigo-900/60 text-sm font-mono bg-indigo-50/50 dark:bg-indigo-950/30 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all ${selectedDomainId ? "rounded-l-lg border-r-0" : "rounded-lg"}`}
                    spellCheck={false}
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                  {selectedDomain && (
                    <span className="px-3 py-2 border border-indigo-200 dark:border-indigo-900/60 border-l-0 rounded-r-lg text-sm font-mono bg-indigo-100/60 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 shrink-0">
                      @{selectedDomain.name}
                    </span>
                  )}
                </div>
                {/* Domain selector */}
                {Array.isArray(publicDomains) && publicDomains.length > 0 && (
                  <select
                    value={selectedDomainId}
                    onChange={(e) => {
                      setSelectedDomainId(e.target.value);
                      if (e.target.value && emailInputValue.includes("@")) setEmailInputValue("");
                    }}
                    className="px-2 py-2 border border-indigo-200 dark:border-indigo-900/60 rounded-lg text-sm bg-indigo-50/50 dark:bg-indigo-950/30 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all max-w-[200px]"
                  >
                    <option value="">{t("home.allDomains")}</option>
                    {publicDomains.map((d) => (
                      <option key={d.id} value={String(d.id)}>@{d.name}</option>
                    ))}
                  </select>
                )}
                {address && (
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-full tracking-wide shrink-0 ${isOnline ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-500/20 text-slate-400 border border-slate-500/30"}`}>
                    {isOnline ? t("home.online") : t("home.offline")}
                  </span>
                )}
              </div>
            </div>

            {address && (
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className="font-semibold text-violet-600 dark:text-violet-400 shrink-0">{t("home.urlLabel")}</span>
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
                <Copy className="h-3.5 w-3.5 mr-1" /> {t("home.copyEmail")}
              </Button>
              <Button
                size="sm"
                className="bg-sky-500 hover:bg-sky-400 text-white border-0 shadow-sm shadow-sky-500/30 font-semibold"
                onClick={handleCheckEmail}
                disabled={!emailInputValue.trim() || isFetching}
              >
                {(createCustom.isPending || isFetching) ? <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                {selectedDomainId && emailInputValue.trim() && !emailInputValue.includes("@") ? t("home.createCustom") : t("home.checkInbox")}
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
                {t("home.generateNew")}
              </Button>

              {address && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveEmail}
                  className={`border font-semibold transition-colors ${isSaved ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/50" : "border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                  title={isSaved ? t("home.unsaveEmailTitle") : t("home.saveEmailTitle")}
                >
                  {isSaved
                    ? <><BookmarkCheck className="h-3.5 w-3.5 mr-1" /> {t("home.saved")}</>
                    : <><Bookmark className="h-3.5 w-3.5 mr-1" /> {t("home.saveEmail")}</>}
                </Button>
              )}
              {address && (
                <Button size="sm" variant="outline" onClick={handleExtend} disabled={extend.isPending} className="border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${extend.isPending ? "animate-spin" : ""}`} /> {t("home.extendTime")}
                </Button>
              )}
            </div>

            {/* Inbox label row: 2FA + custom domain */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              <span className="font-bold text-base shrink-0 text-violet-700 dark:text-violet-400">Inbox:</span>
              <div className="flex-1 flex flex-wrap items-center gap-2">
                <Input
                  value={totpSecret}
                  onChange={(e) => setTotpSecret(e.target.value)}
                  placeholder={t("home.totpPlaceholder")}
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
                    {totpLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : t("home.copy2fa")}
                  </Button>
                )}
                {isSignedIn ? (
                  <button
                    onClick={() => setAddDomainOpen(true)}
                    className="flex items-center gap-1 px-3 h-8 text-sm bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors shrink-0"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Add Domain
                  </button>
                ) : (
                  <Link href="/sign-in">
                    <button className="flex items-center gap-1 px-3 h-8 text-sm bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors">
                      <ExternalLink className="h-3.5 w-3.5" /> {t("home.addDomain")}
                    </button>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Pagination bar */}
          <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-indigo-50/40 dark:bg-indigo-950/20 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-600 dark:text-slate-400">{t("home.showLabel")}</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="px-2 py-0.5 border border-indigo-200 dark:border-indigo-900/60 rounded-md text-sm bg-white dark:bg-slate-800"
              >
                {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="text-slate-600 dark:text-slate-400">{t("home.perPage")}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-500 dark:text-slate-400 text-xs">
                {totalEmails === 0 ? t("home.noEmails") : t("home.showingCount", { from: showingFrom, to: showingTo, total: totalEmails })}
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
                  <th className="text-left px-4 py-2.5 font-semibold uppercase text-xs tracking-wider w-1/4">{t("home.colSender")}</th>
                  <th className="text-left px-4 py-2.5 font-semibold uppercase text-xs tracking-wider">{t("home.colSubject")}</th>
                  <th className="text-left px-4 py-2.5 font-semibold uppercase text-xs tracking-wider w-36 hidden sm:table-cell">{t("home.colDate")}</th>
                  <th className="text-left px-4 py-2.5 font-semibold uppercase text-xs tracking-wider w-24">{t("home.colActions")}</th>
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
                        <span>{t("home.noAddressHint")}</span>
                      </div>
                    </td>
                  </tr>
                ) : pagedEmails.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-400">
                      {t("home.noEmailsFound")}
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
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">{email.subject || t("home.noSubject")}</span>
                          {email.hasAttachments && <Paperclip className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                          {extractQuickData(`${email.subject} ${email.preview}`).map((item) =>
                            item.type === "otp" ? (
                              <button
                                key="otp"
                                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(item.value); toast({ title: t("home.otpCopied"), description: item.value }); }}
                                className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-xs font-mono font-bold hover:bg-amber-200 dark:hover:bg-amber-800/70 border border-amber-300 dark:border-amber-700 transition-colors"
                                title={t("home.clickToCopyOtp")}
                              >
                                <KeyRound className="h-2.5 w-2.5" /> {item.value}
                              </button>
                            ) : (
                              <a
                                key="link"
                                href={item.value}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-200 dark:hover:bg-indigo-800/70 border border-indigo-300 dark:border-indigo-700 transition-colors"
                                title={t("home.openVerifyLink")}
                              >
                                <Link2 className="h-2.5 w-2.5" /> Verify
                              </a>
                            )
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-xs hidden sm:table-cell whitespace-nowrap">
                        {formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={(e) => handleDeleteEmail(e, email.id)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                          aria-label={t("home.delete")}
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

        {/* Saved Emails Panel — logged-in users always see it; others only when they have saved */}
        {(isSignedIn || savedEmails.length > 0) && savedEmails.length > 0 && (
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-xl border border-white/20 shadow-lg shadow-black/20 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-800/40">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-violet-500" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t("home.savedEmails")}</span>
                <span className="px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 text-xs font-bold">{savedEmails.length}</span>
              </div>
              <button
                onClick={() => { setSavedEmails([]); toast({ title: t("home.allDeleted") }); }}
                className="text-xs text-slate-400 hover:text-rose-500 transition-colors"
              >
                {t("home.clearSaved")}
              </button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto">
              {savedEmails.map((email) => (
                <div
                  key={email}
                  className={`flex items-center gap-2 px-4 py-2 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 transition-colors group ${
                    email === address ? "bg-violet-50 dark:bg-violet-950/30" : ""
                  }`}
                >
                  <button
                    className="flex-1 flex items-center gap-2 min-w-0 text-left"
                    onClick={() => { setLocalAddress(email); setLocation(`/inbox/${email}`); }}
                  >
                    <Pin className={`h-3 w-3 shrink-0 ${
                      email === address
                        ? "text-violet-500"
                        : "text-slate-300 dark:text-slate-600 group-hover:text-indigo-400"
                    }`} />
                    <span className={`font-mono text-sm truncate ${
                      email === address
                        ? "text-violet-700 dark:text-violet-300 font-semibold"
                        : "text-slate-600 dark:text-slate-400"
                    }`}>{email}</span>
                    {email === address && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-600 dark:text-violet-400 text-xs font-bold shrink-0">active</span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setSavedEmails(savedEmails.filter((e) => e !== email));
                      toast({ title: t("home.unsavedToast"), description: email });
                    }}
                    className="p-1 rounded-md text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                    title={t("home.unsavedToast")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Important Notice */}
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded-xl border border-white/20 shadow-lg shadow-black/20 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-violet-500 to-indigo-500" />
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">{t("home.noticeTitle")}</h3>
          </div>
          <ul className="space-y-1.5 text-sm text-slate-500 dark:text-slate-400 list-disc pl-5">
            <li>{t("home.notice1")}</li>
            <li>{t("home.notice2")}</li>
            <li><Trans i18nKey="home.notice3" components={{ 1: <strong className="text-slate-700 dark:text-slate-300" /> }} /></li>
            <li><Trans i18nKey="home.notice4" components={{ 1: <strong className="text-slate-700 dark:text-slate-300" /> }} /></li>
            <li>{t("home.notice5")}</li>
            <li><Trans i18nKey="home.notice6" components={{ 1: <strong className="text-rose-600 dark:text-rose-400" /> }} /></li>
          </ul>
        </div>

        <AdRenderer placement="inbox_top" />
      </div>

      <AddDomainDialog open={addDomainOpen} onClose={() => setAddDomainOpen(false)} />

      <AdWallModal
        open={adWallOpen}
        onComplete={() => { adPendingAction.current?.(); adPendingAction.current = null; }}
        onClose={() => { setAdWallOpen(false); adPendingAction.current = null; }}
      />

      {/* Custom Inbox Dialog */}
      <Dialog open={customDialogOpen} onOpenChange={(o) => { setCustomDialogOpen(o); if (!o) setCustomUsername(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AtSign className="h-5 w-5 text-violet-500" />
              {t("home.customInboxTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              {t("home.customDialogDesc")}
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
              <p className="text-xs text-muted-foreground">{t("home.customLocalHint")}</p>
            </div>
            <div className="space-y-2">
              <Label>Domain</Label>
              {Array.isArray(publicDomains) && publicDomains.length > 0 ? (
                <Select value={customDomainId} onValueChange={setCustomDomainId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("home.selectDomain")} />
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
                <p className="text-sm text-muted-foreground italic">{t("home.noPublicDomains")}</p>
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
                ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> {t("home.customCreating")}</>
                : <><Wand2 className="h-4 w-4 mr-2" /> {t("home.customCreate")}</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PublicLayout>
  );
}
