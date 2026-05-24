import { AdminLayout } from "@/components/layout/admin-layout";
import {
  useListAds,
  useCreateAd,
  useUpdateAd,
  useDeleteAd,
  getListAdsQueryKey,
  getGetActiveAdsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw, Plus, Trash2, Megaphone } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

type Placement = "header" | "sidebar" | "inbox_top" | "email_body";

const PLACEMENT_LABELS: Record<Placement, string> = {
  header: "Header",
  sidebar: "Sidebar",
  inbox_top: "Inbox Top",
  email_body: "Email Body",
};

const PLACEMENT_COLORS: Record<Placement, string> = {
  header: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  sidebar: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  inbox_top: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  email_body: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

export default function Ads() {
  const { data: ads, isLoading } = useListAds();
  const createAd = useCreateAd();
  const updateAd = useUpdateAd();
  const deleteAd = useDeleteAd();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newAd, setNewAd] = useState<{
    name: string; placement: Placement; content: string;
    imageUrl: string; linkUrl: string; isActive: boolean;
  }>({ name: "", placement: "sidebar", content: "", imageUrl: "", linkUrl: "", isActive: true });

  const invalidateAds = () => {
    queryClient.invalidateQueries({ queryKey: getListAdsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetActiveAdsQueryKey() });
  };

  const handleCreate = () => {
    createAd.mutate({ data: newAd }, {
      onSuccess: () => {
        invalidateAds();
        setIsCreateOpen(false);
        setNewAd({ name: "", placement: "sidebar", content: "", imageUrl: "", linkUrl: "", isActive: true });
        toast({ title: "Campaign created" });
      },
    });
  };

  const handleToggleActive = (id: number, isActive: boolean) => {
    updateAd.mutate({ id, data: { isActive } }, { onSuccess: () => invalidateAds() });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this campaign?")) return;
    deleteAd.mutate({ id }, {
      onSuccess: () => { invalidateAds(); toast({ title: "Campaign deleted" }); },
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ad Campaigns</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Manage ads displayed to users.</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0 shrink-0">
                <Plus className="h-4 w-4 mr-2" /> New Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Create Ad Campaign</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Campaign Name</Label>
                    <Input placeholder="e.g. Summer Sale" value={newAd.name} onChange={(e) => setNewAd({ ...newAd, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Placement</Label>
                    <Select value={newAd.placement} onValueChange={(v: Placement) => setNewAd({ ...newAd, placement: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="header">Header (Top)</SelectItem>
                        <SelectItem value="sidebar">Sidebar</SelectItem>
                        <SelectItem value="inbox_top">Inbox Top (Above emails)</SelectItem>
                        <SelectItem value="email_body">Email Body (Inside email)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center justify-between">
                    <span>Content / Embed Code</span>
                    <span className="text-[10px] font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      Supports: text · HTML · AdSense · ad network code
                    </span>
                  </Label>
                  <Textarea
                    placeholder={`Choose one:\n① Text: 50% off today!\n② HTML: <b>Flash Sale</b> <a href="...">Shop now</a>\n③ AdSense/network code: paste full <script>...</script> or <ins class="adsbygoogle"...>`}
                    value={newAd.content}
                    onChange={(e) => setNewAd({ ...newAd, content: e.target.value })}
                    className="h-32 font-mono text-xs"
                  />
                  {newAd.content.trim().startsWith("<script") || newAd.content.includes("<ins ") ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      ✓ Embed code detected — will run in a sandboxed iframe (AdSense/network)
                    </p>
                  ) : newAd.content.includes("<") ? (
                    <p className="text-xs text-indigo-500 flex items-center gap-1">
                      ✓ HTML detected — will render directly
                    </p>
                  ) : newAd.content ? (
                    <p className="text-xs text-muted-foreground">Plain text</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label>Image URL <span className="text-muted-foreground font-normal">(optional — for self-managed ads only)</span></Label>
                  <Input placeholder="https://example.com/banner.jpg" value={newAd.imageUrl} onChange={(e) => setNewAd({ ...newAd, imageUrl: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Destination URL <span className="text-muted-foreground font-normal">(optional — skip if using embed code)</span></Label>
                  <Input placeholder="https://example.com/promo" value={newAd.linkUrl} onChange={(e) => setNewAd({ ...newAd, linkUrl: e.target.value })} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                  <Label className="font-medium">Activate immediately</Label>
                  <Switch checked={newAd.isActive} onCheckedChange={(v) => setNewAd({ ...newAd, isActive: v })} />
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0"
                  onClick={handleCreate}
                  disabled={createAd.isPending || !newAd.name || !newAd.content}
                >
                  {createAd.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Create Campaign"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_80px_100px_50px] gap-4 px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Campaign</span>
            <span>Placement</span>
            <span>Active</span>
            <span>Impressions</span>
            <span />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : !ads?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Megaphone className="h-10 w-10 opacity-20" />
              <p className="text-sm">No campaigns yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {ads.map((ad) => (
                <div key={ad.id} className="grid grid-cols-[1fr_120px_80px_100px_50px] gap-4 items-center px-5 py-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{ad.name}</div>
                    {ad.linkUrl && (
                      <div className="text-xs text-muted-foreground truncate mt-0.5">{ad.linkUrl}</div>
                    )}
                  </div>
                  <div>
                    <Badge className={`text-xs border-0 ${PLACEMENT_COLORS[ad.placement as Placement] ?? "bg-slate-100 text-slate-700"}`}>
                      {PLACEMENT_LABELS[ad.placement as Placement] ?? ad.placement}
                    </Badge>
                  </div>
                  <div>
                    <Switch
                      checked={ad.isActive}
                      onCheckedChange={(v) => handleToggleActive(ad.id, v)}
                      disabled={updateAd.isPending}
                    />
                  </div>
                  <div className="text-sm font-medium tabular-nums">{ad.impressions.toLocaleString()}</div>
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      onClick={() => handleDelete(ad.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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
