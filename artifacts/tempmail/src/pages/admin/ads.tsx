import { AdminLayout } from "@/components/layout/admin-layout";
import { 
  useListAds, 
  useCreateAd, 
  useUpdateAd, 
  useDeleteAd,
  getListAdsQueryKey,
  getGetActiveAdsQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

export default function Ads() {
  const { data: ads, isLoading } = useListAds();
  const createAd = useCreateAd();
  const updateAd = useUpdateAd();
  const deleteAd = useDeleteAd();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newAd, setNewAd] = useState<{
    name: string;
    placement: Placement;
    content: string;
    imageUrl: string;
    linkUrl: string;
    isActive: boolean;
  }>({
    name: "",
    placement: "sidebar",
    content: "",
    imageUrl: "",
    linkUrl: "",
    isActive: true
  });

  const invalidateAds = () => {
    queryClient.invalidateQueries({ queryKey: getListAdsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetActiveAdsQueryKey() });
  };

  const handleCreate = () => {
    createAd.mutate({ data: newAd }, {
      onSuccess: () => {
        invalidateAds();
        setIsCreateOpen(false);
        setNewAd({
          name: "",
          placement: "sidebar",
          content: "",
          imageUrl: "",
          linkUrl: "",
          isActive: true
        });
        toast({ title: "Campaign added successfully" });
      }
    });
  };

  const handleToggleActive = (id: number, isActive: boolean) => {
    updateAd.mutate({ id, data: { isActive } }, {
      onSuccess: () => invalidateAds()
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure?")) return;
    deleteAd.mutate({ id }, {
      onSuccess: () => {
        invalidateAds();
        toast({ title: "Campaign deleted" });
      }
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Ad Campaigns</h1>
            <p className="text-muted-foreground">Manage advertisements shown to end-users.</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Create Campaign</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Create Ad Campaign</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Campaign Name</Label>
                    <Input placeholder="e.g., Summer Sale" value={newAd.name} onChange={(e) => setNewAd({...newAd, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Placement</Label>
                    <Select value={newAd.placement} onValueChange={(v: Placement) => setNewAd({...newAd, placement: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="header">Header (Top of page)</SelectItem>
                        <SelectItem value="sidebar">Sidebar</SelectItem>
                        <SelectItem value="inbox_top">Inbox Top (Above emails)</SelectItem>
                        <SelectItem value="email_body">Email Body (Inside emails)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Ad Content (HTML allowed)</Label>
                  <Textarea 
                    placeholder="<strong>Limited offer!</strong> Click here to buy." 
                    value={newAd.content} 
                    onChange={(e) => setNewAd({...newAd, content: e.target.value})} 
                    className="h-24"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Image URL (Optional)</Label>
                  <Input placeholder="https://example.com/banner.jpg" value={newAd.imageUrl} onChange={(e) => setNewAd({...newAd, imageUrl: e.target.value})} />
                </div>

                <div className="space-y-2">
                  <Label>Target Link (Optional)</Label>
                  <Input placeholder="https://example.com/promo" value={newAd.linkUrl} onChange={(e) => setNewAd({...newAd, linkUrl: e.target.value})} />
                </div>

                <div className="flex items-center justify-between pt-2 pb-2">
                  <Label>Active (show immediately)</Label>
                  <Switch checked={newAd.isActive} onCheckedChange={(v) => setNewAd({...newAd, isActive: v})} />
                </div>

                <Button className="w-full" onClick={handleCreate} disabled={createAd.isPending || !newAd.name || !newAd.content}>
                  {createAd.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Create Campaign"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-card border rounded-lg shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Placement</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Impressions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : !ads?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No campaigns created yet.
                  </TableCell>
                </TableRow>
              ) : (
                ads.map((ad) => (
                  <TableRow key={ad.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <Megaphone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        {ad.name}
                        {ad.linkUrl && <div className="text-xs text-muted-foreground font-normal truncate max-w-[200px]">{ad.linkUrl}</div>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {ad.placement.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch 
                        checked={ad.isActive} 
                        onCheckedChange={(v) => handleToggleActive(ad.id, v)}
                        disabled={updateAd.isPending}
                      />
                    </TableCell>
                    <TableCell>{ad.impressions.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(ad.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
