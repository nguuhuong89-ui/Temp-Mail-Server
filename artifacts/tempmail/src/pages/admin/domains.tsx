import { AdminLayout } from "@/components/layout/admin-layout";
import { 
  useListDomains, 
  useCreateDomain, 
  useUpdateDomain, 
  useDeleteDomain, 
  useCheckDomainDns,
  getListDomainsQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Plus, Trash2, Globe, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

export default function Domains() {
  const { data: domains, isLoading } = useListDomains();
  const createDomain = useCreateDomain();
  const updateDomain = useUpdateDomain();
  const deleteDomain = useDeleteDomain();
  const checkDns = useCheckDomainDns();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [newDomainPublic, setNewDomainPublic] = useState(true);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [editingDomainId, setEditingDomainId] = useState<number | null>(null);
  const [editingWebhookUrl, setEditingWebhookUrl] = useState("");

  const handleCreate = () => {
    createDomain.mutate(
      {
        data: {
          name: newDomain,
          isPublic: newDomainPublic,
          webhookUrl: newWebhookUrl.trim() || null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDomainsQueryKey() });
          setIsCreateOpen(false);
          setNewDomain("");
          setNewWebhookUrl("");
          toast({ title: "Domain added successfully" });
        },
        onError: () => toast({ title: "Failed to add domain", variant: "destructive" }),
      },
    );
  };

  const handleSaveWebhook = (id: number) => {
    updateDomain.mutate(
      { id, data: { webhookUrl: editingWebhookUrl.trim() || null } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDomainsQueryKey() });
          setEditingDomainId(null);
          toast({ title: "Webhook saved" });
        },
        onError: () => toast({ title: "Invalid webhook URL", variant: "destructive" }),
      },
    );
  };

  const handleTogglePublic = (id: number, isPublic: boolean) => {
    updateDomain.mutate({ id, data: { isPublic } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDomainsQueryKey() });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure? This will delete the domain and all associated inboxes/emails.")) return;
    deleteDomain.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDomainsQueryKey() });
        toast({ title: "Domain deleted" });
      }
    });
  };

  const handleCheckDns = (id: number) => {
    checkDns.mutate({ id }, {
      onSuccess: (res) => {
        if (res.mxValid) {
          toast({ title: "DNS Check Passed", description: "MX records are correctly configured." });
        } else {
          toast({ title: "DNS Check Failed", description: "MX records are missing or incorrect.", variant: "destructive" });
        }
      }
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Domains</h1>
            <p className="text-muted-foreground">Manage the email suffix pool for your instance.</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Add Domain</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Domain</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Domain Name</Label>
                  <Input placeholder="example.com" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <Label>Public (available for random generation)</Label>
                  <Switch checked={newDomainPublic} onCheckedChange={setNewDomainPublic} />
                </div>
                <div className="space-y-2">
                  <Label>Webhook URL (optional)</Label>
                  <Input
                    placeholder="https://hooks.example.com/incoming"
                    value={newWebhookUrl}
                    onChange={(e) => setNewWebhookUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Notified via POST when an email arrives at this domain.
                  </p>
                </div>
                <Button className="w-full" onClick={handleCreate} disabled={createDomain.isPending || !newDomain}>
                  {createDomain.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Add Domain"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-card border rounded-lg shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Public</TableHead>
                <TableHead>Emails Received</TableHead>
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
              ) : !domains?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No domains configured. Add one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                domains.map((domain) => (
                  <TableRow key={domain.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      {domain.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant={domain.status === 'active' ? 'default' : 'secondary'}>
                        {domain.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch 
                        checked={domain.isPublic} 
                        onCheckedChange={(v) => handleTogglePublic(domain.id, v)}
                        disabled={updateDomain.isPending}
                      />
                    </TableCell>
                    <TableCell>{domain.emailCount.toLocaleString()}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Dialog
                        open={editingDomainId === domain.id}
                        onOpenChange={(o) => {
                          if (o) {
                            setEditingDomainId(domain.id);
                            setEditingWebhookUrl(domain.webhookUrl ?? "");
                          } else {
                            setEditingDomainId(null);
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            Webhook {domain.webhookUrl ? <span className="ml-1 text-primary">●</span> : null}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Webhook for {domain.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3 pt-2">
                            <Label>POST URL (leave empty to disable)</Label>
                            <Input
                              placeholder="https://hooks.example.com/incoming"
                              value={editingWebhookUrl}
                              onChange={(e) => setEditingWebhookUrl(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              Each incoming email triggers a POST with JSON payload (event, fromAddress, toAddress, subject, preview, ...).
                            </p>
                            <Button
                              className="w-full"
                              onClick={() => handleSaveWebhook(domain.id)}
                              disabled={updateDomain.isPending}
                            >
                              Save webhook
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button variant="outline" size="sm" onClick={() => handleCheckDns(domain.id)}>
                        Check DNS
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(domain.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
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
