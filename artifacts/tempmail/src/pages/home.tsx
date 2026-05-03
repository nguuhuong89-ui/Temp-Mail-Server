import { PublicLayout } from "@/components/layout/public-layout";
import { Show } from "@clerk/react";
import { CloudCheck, CloudOff } from "lucide-react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useInboxStream } from "@/hooks/use-inbox-stream";
import {
  useCreateRandomInbox,
  useGetInbox,
  useExtendInbox,
  useDeleteInboxEmail,
  getGetInboxQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Copy, RefreshCw, Clock, Inbox as InboxIcon, ChevronRight, Paperclip, Mail, QrCode, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdRenderer } from "@/components/ad-renderer";
import { Countdown } from "@/components/countdown";
import { Link, useParams } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";

export default function Home() {
  const params = useParams();
  const [localAddress, setLocalAddress] = useLocalStorage<string | null>("tempmail_address", null);
  const address = params.address || localAddress;
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: inbox, isLoading } = useGetInbox(address || "", {
    query: { enabled: !!address, queryKey: getGetInboxQueryKey(address || "") }
  });

  const createRandom = useCreateRandomInbox();
  const extend = useExtendInbox();
  const deleteEmail = useDeleteInboxEmail();
  const [qrOpen, setQrOpen] = useState(false);

  useInboxStream(address || undefined);

  useEffect(() => {
    if (params.address && params.address !== localAddress) {
      setLocalAddress(params.address);
    }
  }, [params.address, localAddress, setLocalAddress]);

  const handleGenerate = () => {
    createRandom.mutate(undefined, {
      onSuccess: (data) => {
        setLocalAddress(data.address);
        window.history.pushState({}, '', `/inbox/${data.address}`);
      }
    });
  };

  const handleCopy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    toast({
      title: "Address copied",
      description: "Copied to clipboard successfully.",
    });
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
          toast({ title: "Email deleted" });
        },
      },
    );
  };

  const handleExtend = () => {
    if (!address) return;
    extend.mutate({ address }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey(address) });
        toast({
          title: "Inbox extended",
          description: "Added 10 more minutes.",
        });
      }
    });
  };

  return (
    <PublicLayout>
      <div className="container max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-12">
        <AdRenderer placement="header" />
        
        <div className="mt-4 sm:mt-8 text-center space-y-3 sm:space-y-4">
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tight">Your Throwaway Inbox</h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            Keep your real inbox clean. Instantly receive verification codes, test emails, and avoid spam.
          </p>
        </div>

        <div className="mt-6 sm:mt-12 bg-card border rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 sm:p-6 md:p-12 border-b bg-muted/30 flex flex-col items-center justify-center gap-4 sm:gap-6">
            {!address ? (
              <div className="flex flex-col items-center gap-4">
                <Button size="lg" onClick={handleGenerate} disabled={createRandom.isPending} className="text-lg h-14 px-8 rounded-full">
                  {createRandom.isPending ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <Mail className="mr-2 h-5 w-5" />}
                  Generate New Inbox
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 w-full max-w-2xl">
                  <div className="flex-1 min-w-0 bg-background border-2 border-primary/20 rounded-xl p-3 sm:p-4 md:p-6 flex items-center justify-between gap-2 group hover:border-primary/50 transition-colors cursor-pointer" onClick={handleCopy}>
                    <span className="text-sm sm:text-xl md:text-3xl font-bold truncate select-all font-mono">{address}</span>
                    <Button variant="ghost" size="icon" className="shrink-0 opacity-50 group-hover:opacity-100 transition-opacity h-8 w-8 sm:h-10 sm:w-10">
                      <Copy className="h-4 w-4 sm:h-6 sm:w-6" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs">
                  <Show when="signed-in">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" data-testid="badge-saved">
                      <CloudCheck className="h-3 w-3" /> Đã lưu vào tài khoản
                    </span>
                  </Show>
                  <Show when="signed-out">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-muted-foreground">
                      <CloudOff className="h-3 w-3" /> <Link href="/sign-in" className="underline hover:text-foreground">Đăng nhập</Link> để lưu lịch sử inbox
                    </span>
                  </Show>
                </div>
                {inbox && (
                  <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-full border shadow-sm">
                      <Clock className="h-4 w-4 text-primary" />
                      Expires in: <Countdown expiresAt={inbox.expiresAt} />
                    </div>
                    <Button variant="outline" size="sm" onClick={handleExtend} disabled={extend.isPending} className="rounded-full">
                      {extend.isPending ? <RefreshCw className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
                      Add 10 mins
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleGenerate} className="rounded-full">
                      Generate New
                    </Button>
                    <Dialog open={qrOpen} onOpenChange={setQrOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="rounded-full">
                          <QrCode className="mr-2 h-3 w-3" /> Share QR
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-sm">
                        <DialogHeader>
                          <DialogTitle>Scan to open this inbox</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col items-center gap-4 pt-2">
                          <div className="bg-white p-4 rounded-xl border">
                            <QRCodeSVG
                              value={`${window.location.origin}${import.meta.env.BASE_URL}inbox/${address}`}
                              size={220}
                              level="M"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground font-mono break-all text-center">
                            {address}
                          </p>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 min-h-[400px]">
            <div className="lg:col-span-3 p-3 sm:p-4 md:p-6 flex flex-col">
              <AdRenderer placement="inbox_top" />
              
              <div className="mt-4 flex-1">
                {isLoading && address ? (
                  <div className="h-full flex items-center justify-center">
                    <RefreshCw className="h-8 w-8 text-muted-foreground animate-spin" />
                  </div>
                ) : !inbox || inbox.emails.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-12">
                    <InboxIcon className="h-16 w-16 opacity-20 mb-4" />
                    <p className="text-lg font-medium">Your inbox is empty</p>
                    <p className="text-sm mt-1">Waiting for incoming emails...</p>
                    <div className="mt-8 flex gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {inbox.emails.map((email, i) => (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={email.id}
                      >
                        <Link href={`/email/${email.id}`} className="block group">
                          <div className="p-3 sm:p-4 rounded-xl border bg-background hover:border-primary/50 hover:shadow-md transition-all flex items-center gap-3 sm:gap-4">
                            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                              {email.fromAddress.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-0.5 sm:mb-1">
                                <span className="font-semibold truncate text-sm sm:text-base">{email.fromAddress}</span>
                                <span className="text-[11px] sm:text-xs text-muted-foreground shrink-0">
                                  {formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate">{email.subject || "No Subject"}</span>
                                {email.hasAttachments && <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />}
                              </div>
                              <p className="text-xs text-muted-foreground truncate mt-1 hidden sm:block">
                                {email.preview}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleDeleteEmail(e, email.id)}
                              className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0 h-8 w-8 sm:h-10 sm:w-10"
                              aria-label="Delete email"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <ChevronRight className="hidden sm:block h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Sidebar ad column — hidden on mobile to save vertical space.
                AdRenderer returns null when no ad is configured. */}
            <div className="hidden lg:block border-l bg-muted/10 p-4">
              <div className="sticky top-24">
                <AdRenderer placement="sidebar" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
