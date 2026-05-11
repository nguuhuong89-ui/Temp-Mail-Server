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
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
          toast({ title: "Đã thêm vào blocklist" });
        },
        onError: () => toast({ title: "Thêm thất bại", variant: "destructive" }),
      },
    );
  };

  const remove = (id: number) => {
    del.mutate({ id }, { onSuccess: () => { refresh(); toast({ title: "Đã xóa" }); } });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Blocklist</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Chặn mail đến từ sender hoặc domain cụ thể.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 border-0 shrink-0">
                <Plus className="h-4 w-4 mr-2" /> Thêm Rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Thêm Blocklist Rule</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Kiểu chặn</Label>
                  <Select value={type} onValueChange={(v) => setType(v as "sender" | "domain")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sender">Exact sender (VD: spam@example.com)</SelectItem>
                      <SelectItem value="domain">Toàn bộ domain (VD: example.com)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Pattern</Label>
                  <Input
                    placeholder={type === "sender" ? "spammer@example.com" : "spam-domain.com"}
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ghi chú (tùy chọn)</Label>
                  <Input
                    placeholder="Lý do chặn?"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 border-0"
                  onClick={submit}
                  disabled={create.isPending || !pattern.trim()}
                >
                  {create.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Thêm vào blocklist"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="grid grid-cols-[1fr_90px_1fr_50px] gap-4 px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Pattern</span>
            <span>Kiểu</span>
            <span>Ghi chú</span>
            <span />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span className="text-sm">Đang tải...</span>
            </div>
          ) : !entries?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <ShieldAlert className="h-10 w-10 opacity-20" />
              <p className="text-sm">Chưa có rule nào. Thêm để bắt đầu lọc spam.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {entries.map((e) => (
                <div key={e.id} className="grid grid-cols-[1fr_90px_1fr_50px] gap-4 items-center px-5 py-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="font-mono text-sm">{e.pattern}</div>
                  <div>
                    <Badge
                      className={e.type === "domain"
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-0 text-xs"
                        : "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border-0 text-xs"}
                    >
                      {e.type}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground truncate">{e.note || "—"}</div>
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      onClick={() => remove(e.id)}
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
