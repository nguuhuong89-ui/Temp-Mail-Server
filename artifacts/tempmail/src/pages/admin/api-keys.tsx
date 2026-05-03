import { AdminLayout } from "@/components/layout/admin-layout";
import {
  useListApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  useDeleteApiKey,
  getListApiKeysQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, RefreshCw, Trash2, Key, Copy, AlertCircle, Ban } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";

export default function ApiKeys() {
  const { data: keys, isLoading } = useListApiKeys();
  const create = useCreateApiKey();
  const revoke = useRevokeApiKey();
  const del = useDeleteApiKey();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: getListApiKeysQueryKey() });

  const submit = () => {
    if (!name.trim()) return;
    create.mutate(
      { data: { name: name.trim() } },
      {
        onSuccess: (res) => {
          setNewSecret(res.plaintext);
          setName("");
          refresh();
        },
        onError: () => toast({ title: "Failed to create key", variant: "destructive" }),
      },
    );
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
            <p className="text-muted-foreground">
              Programmatic access for AI agents and integrations.{" "}
              <Link href="/admin/api-docs" className="text-primary underline">View API docs →</Link>
            </p>
          </div>
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) setNewSecret(null);
            }}
          >
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Create Key</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{newSecret ? "Save your key now" : "Create API key"}</DialogTitle>
              </DialogHeader>
              {newSecret ? (
                <div className="space-y-4 pt-2">
                  <div className="flex gap-2 items-start text-sm bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 rounded-lg p-3">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      This is the only time the full key will be shown. Copy it now and store it securely.
                    </div>
                  </div>
                  <div className="font-mono text-sm bg-muted p-3 rounded-lg break-all">
                    {newSecret}
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={() => copy(newSecret)}>
                      <Copy className="h-4 w-4 mr-2" /> Copy
                    </Button>
                    <Button variant="outline" onClick={() => { setOpen(false); setNewSecret(null); }}>
                      Done
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Name / purpose</Label>
                    <Input
                      placeholder="e.g. Zapier integration"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <Button className="w-full" onClick={submit} disabled={create.isPending || !name.trim()}>
                    {create.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Generate key"}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-card border rounded-lg shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell></TableRow>
              ) : !keys?.length ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  <Key className="h-6 w-6 mx-auto mb-2 opacity-40" />
                  No API keys yet. Create one to let agents access your inboxes.
                </TableCell></TableRow>
              ) : (
                keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell className="font-mono text-xs">{k.prefix}…</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(k.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {k.lastUsedAt ? formatDistanceToNow(new Date(k.lastUsedAt), { addSuffix: true }) : "Never"}
                    </TableCell>
                    <TableCell>
                      {k.revokedAt ? (
                        <Badge variant="destructive">Revoked</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {!k.revokedAt && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => revoke.mutate({ id: k.id }, { onSuccess: () => { refresh(); toast({ title: "Revoked" }); } })}
                        >
                          <Ban className="h-3 w-3 mr-1" /> Revoke
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => del.mutate({ id: k.id }, { onSuccess: () => { refresh(); toast({ title: "Deleted" }); } })}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
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
