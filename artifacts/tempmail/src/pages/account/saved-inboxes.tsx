import { AccountLayout } from "@/components/layout/account-layout";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookmarkCheck, RefreshCw, Trash2, ExternalLink, Mail, Pencil, Check, X } from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

type SavedInboxItem = {
  id: number;
  address: string;
  label: string | null;
  savedAt: string;
  inboxCreatedAt: string | null;
  emailCount: number;
  lastEmailAt: string | null;
};

export default function AccountSavedInboxes() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const { data, isLoading } = useQuery<SavedInboxItem[]>({
    queryKey: ["/account/saved-inboxes"],
    queryFn: () => apiFetch<SavedInboxItem[]>("/api/account/saved-inboxes"),
  });

  const del = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/account/saved-inboxes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/account/saved-inboxes"] });
      toast({ title: t("account.savedInboxRemoved") });
    },
  });

  const updateLabel = useMutation({
    mutationFn: ({ id, label }: { id: number; label: string }) =>
      apiFetch(`/api/account/saved-inboxes/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ label }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/account/saved-inboxes"] });
      setEditingId(null);
      toast({ title: t("common.updated") });
    },
  });

  const startEdit = (item: SavedInboxItem) => {
    setEditingId(item.id);
    setEditLabel(item.label ?? "");
  };

  const saveEdit = () => {
    if (editingId === null) return;
    updateLabel.mutate({ id: editingId, label: editLabel });
  };

  return (
    <AccountLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("account.savedInboxes")}</h1>
          <p className="text-muted-foreground">{t("account.savedInboxesDesc")}</p>
        </div>
        <div className="bg-card border rounded-lg shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("account.address")}</TableHead>
                <TableHead>{t("account.label")}</TableHead>
                <TableHead>{t("account.inboxCreatedAt")}</TableHead>
                <TableHead>{t("account.savedAt")}</TableHead>
                <TableHead className="text-right">{t("account.emailCount")}</TableHead>
                <TableHead>{t("account.lastEmail")}</TableHead>
                <TableHead className="text-right">{t("account.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell></TableRow>
              ) : !data?.length ? (
                <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <BookmarkCheck className="h-8 w-8 opacity-30" />
                    <p>{t("account.noSavedInboxes")}</p>
                    <p className="text-xs">{t("account.noSavedInboxesHint")}</p>
                  </div>
                </TableCell></TableRow>
              ) : (
                data.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">{item.address}</TableCell>
                    <TableCell>
                      {editingId === item.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            className="h-7 text-sm w-40"
                            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingId(null); }}
                            autoFocus
                          />
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveEdit}>
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                          onClick={() => startEdit(item)}
                        >
                          {item.label || <span className="italic opacity-50">{t("account.addLabel")}</span>}
                          <Pencil className="h-3 w-3 opacity-40" />
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.inboxCreatedAt
                        ? formatDistanceToNow(new Date(item.inboxCreatedAt), { addSuffix: true })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(item.savedAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <span className="flex items-center justify-end gap-1">
                        <Mail className="h-3 w-3 text-muted-foreground" />{item.emailCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.lastEmailAt
                        ? formatDistanceToNow(new Date(item.lastEmailAt), { addSuffix: true })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Link href={`/inbox/${item.address}`}>
                        <Button variant="outline" size="sm"><ExternalLink className="h-3 w-3 mr-1" /> {t("account.open")}</Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => del.mutate(item.id)}
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
    </AccountLayout>
  );
}
