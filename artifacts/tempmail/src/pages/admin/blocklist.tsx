import { AdminLayout } from "@/components/layout/admin-layout";
import {
  useListBlocklist,
  useCreateBlocklistEntry,
  useDeleteBlocklistEntry,
  getListBlocklistQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, RefreshCw, Trash2, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Blocklist() {
  const { data: entries, isLoading } = useListBlocklist();
  const create = useCreateBlocklistEntry();
  const del = useDeleteBlocklistEntry();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [pattern, setPattern] = useState("");
  const [type, setType] = useState<"sender" | "domain">("sender");
  const [note, setNote] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: getListBlocklistQueryKey() });

  const submit = () => {
    if (!pattern.trim()) return;
    create.mutate(
      { data: { pattern: pattern.trim(), type, note } },
      {
        onSuccess: () => {
          setOpen(false);
          setPattern("");
          setNote("");
          refresh();
          toast({ title: "Blocklist entry added" });
        },
        onError: () => toast({ title: "Failed to add", variant: "destructive" }),
      },
    );
  };

  const remove = (id: number) => {
    del.mutate({ id }, { onSuccess: () => { refresh(); toast({ title: "Removed" }); } });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Blocklist</h1>
            <p className="text-muted-foreground">
              Block incoming mail from specific sender addresses or domains.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Add Entry</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Block a sender</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Match type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as "sender" | "domain")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sender">Exact sender (e.g. spam@example.com)</SelectItem>
                      <SelectItem value="domain">Whole domain (e.g. example.com)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Pattern</Label>
                  <Input
                    placeholder={type === "sender" ? "spammer@example.com" : "spam-domain.com"}
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Note (optional)</Label>
                  <Input
                    placeholder="Why is this blocked?"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
                <Button className="w-full" onClick={submit} disabled={create.isPending || !pattern.trim()}>
                  {create.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Add to blocklist"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-card border rounded-lg shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pattern</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="h-24 text-center">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell></TableRow>
              ) : !entries?.length ? (
                <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  <ShieldAlert className="h-6 w-6 mx-auto mb-2 opacity-40" />
                  No senders blocked. Add one to start filtering spam.
                </TableCell></TableRow>
              ) : (
                entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-sm">{e.pattern}</TableCell>
                    <TableCell><Badge variant="secondary">{e.type}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{e.note || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(e.id)}
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
