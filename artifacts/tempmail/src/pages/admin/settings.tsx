import { AdminLayout } from "@/components/layout/admin-layout";
import { RefreshCw, Trash2, Clock, Mail, Eye, CheckCircle2, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Settings = { anonRetentionHours: number; emailRetentionDays: number };
type PurgePreview = {
  anonEmailsToDelete: number; allOldEmailsToDelete: number;
  expiredInboxesToDelete: number; anonCutoff: string; allCutoff: string;
};

export default function AdminSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [anonHours, setAnonHours] = useState(24);
  const [retainDays, setRetainDays] = useState(7);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [purgeTarget, setPurgeTarget] = useState<"anon" | "old">("anon");

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["admin-settings"],
    queryFn: () => apiFetch<Settings>("/api/system-settings"),
  });

  const { data: preview, refetch: refetchPreview, isFetching: previewLoading } = useQuery<PurgePreview>({
    queryKey: ["admin-purge-preview"],
    queryFn: () => apiFetch<PurgePreview>("/api/system-settings/purge-preview"),
    refetchInterval: false,
  });

  useEffect(() => {
    if (settings) { setAnonHours(settings.anonRetentionHours); setRetainDays(settings.emailRetentionDays); }
  }, [settings]);

  const saveMut = useMutation({
    mutationFn: () => apiFetch<Settings>("/api/system-settings", {
      method: "PUT",
      body: JSON.stringify({ anonRetentionHours: anonHours, emailRetentionDays: retainDays }),
    }),
    onSuccess: () => {
      toast({ title: "Settings saved" });
      void qc.invalidateQueries({ queryKey: ["admin-settings"] });
      void refetchPreview();
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const purgeAnonMut = useMutation({
    mutationFn: () => apiFetch("/api/system-settings/purge-anon", { method: "POST" }),
    onSuccess: (res: unknown) => {
      const r = res as { deleted: number };
      toast({ title: `Purged ${r.deleted} anonymous email(s)` });
      setConfirmOpen(false);
      void refetchPreview();
    },
    onError: () => toast({ title: "Purge failed", variant: "destructive" }),
  });

  const purgeOldMut = useMutation({
    mutationFn: () => apiFetch("/api/system-settings/purge-old", { method: "POST" }),
    onSuccess: (res: unknown) => {
      const r = res as { deleted: number };
      toast({ title: `Purged ${r.deleted} old email(s)` });
      setConfirmOpen(false);
      void refetchPreview();
    },
    onError: () => toast({ title: "Purge failed", variant: "destructive" }),
  });

  const openPurge = (target: "anon" | "old") => { setPurgeTarget(target); setConfirmOpen(true); };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-32">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Configure email retention policy and automatic cleanup.</p>
        </div>

        {/* Retention Policy */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-indigo-500" />
            <h2 className="font-semibold text-base">Email Retention Policy</h2>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                Anonymous emails (not logged in) — retain up to
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number" min={1} max={168} value={anonHours}
                  onChange={(e) => setAnonHours(Math.max(1, Math.min(168, Number(e.target.value))))}
                  className="w-28 font-mono"
                />
                <span className="text-sm text-muted-foreground">hours (1–168h = 1 hour to 7 days)</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Emails in inboxes with <strong>no owner</strong> will be deleted after this time. Default: 24h.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                All emails — retain up to
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number" min={1} max={90} value={retainDays}
                  onChange={(e) => setRetainDays(Math.max(1, Math.min(90, Number(e.target.value))))}
                  className="w-28 font-mono"
                />
                <span className="text-sm text-muted-foreground">days (1–90 days)</span>
              </div>
              <p className="text-xs text-muted-foreground">
                All emails older than this limit will be deleted on the next cleanup run (every 5 minutes). Default: 7 days.
              </p>
            </div>
          </div>

          <Button
            className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0"
            onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Save Settings
          </Button>
        </div>

        {/* Purge Preview */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-amber-500" />
              <h2 className="font-semibold text-base">Impact Preview</h2>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void refetchPreview()} disabled={previewLoading}>
              <RefreshCw className={`h-3.5 w-3.5 ${previewLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>

          {preview ? (
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20 p-3 text-center">
                <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{preview.anonEmailsToDelete.toLocaleString()}</div>
                <div className="text-xs text-rose-700 dark:text-rose-400 mt-0.5">Anon emails overdue</div>
              </div>
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3 text-center">
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{preview.allOldEmailsToDelete.toLocaleString()}</div>
                <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Old emails (all)</div>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3 text-center">
                <div className="text-2xl font-bold text-slate-600 dark:text-slate-400">{preview.expiredInboxesToDelete.toLocaleString()}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Expired inboxes</div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">Click "Refresh" to see current counts.</div>
          )}
        </div>

        {/* Manual Purge */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-rose-500" />
            <h2 className="font-semibold text-base">Manual Cleanup</h2>
          </div>
          <p className="text-sm text-muted-foreground">Trigger an immediate cleanup using the current policy, without waiting for the automated cycle.</p>
          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" className="gap-2 border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              onClick={() => openPurge("anon")} disabled={purgeAnonMut.isPending}>
              <Trash2 className="h-4 w-4" />
              Purge anonymous emails now ({anonHours}h)
            </Button>
            <Button variant="outline" className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
              onClick={() => openPurge("old")} disabled={purgeOldMut.isPending}>
              <Mail className="h-4 w-4" />
              Purge old emails now ({retainDays}d)
            </Button>
          </div>
        </div>
      </div>

      {/* Confirm Purge */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500" /> Confirm Cleanup
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              {purgeTarget === "anon"
                ? <>Delete <strong className="text-rose-600">{preview?.anonEmailsToDelete.toLocaleString() ?? "?"} anonymous email(s)</strong> received more than {anonHours}h ago. This cannot be undone!</>
                : <>Delete <strong className="text-rose-600">{preview?.allOldEmailsToDelete.toLocaleString() ?? "?"} email(s)</strong> received more than {retainDays} days ago. This cannot be undone!</>}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmOpen(false)}>Cancel</Button>
              <Button variant="destructive" className="flex-1 gap-1.5"
                onClick={() => purgeTarget === "anon" ? purgeAnonMut.mutate() : purgeOldMut.mutate()}
                disabled={purgeAnonMut.isPending || purgeOldMut.isPending}>
                {(purgeAnonMut.isPending || purgeOldMut.isPending) ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Purge Now
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
