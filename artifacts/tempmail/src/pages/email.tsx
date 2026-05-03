import { PublicLayout } from "@/components/layout/public-layout";
import { useGetEmail, getGetEmailQueryKey } from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Clock, Paperclip, RefreshCw, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { AdRenderer } from "@/components/ad-renderer";
import { useDeleteEmail } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function EmailView() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: email, isLoading } = useGetEmail(Number(id), {
    query: { enabled: !!id, queryKey: getGetEmailQueryKey(Number(id)) }
  });

  const deleteEmail = useDeleteEmail();

  const handleDelete = () => {
    if (!email) return;
    deleteEmail.mutate({ id: email.id }, {
      onSuccess: () => {
        toast({ title: "Email deleted" });
        setLocation(`/inbox/${email.toAddress}`);
      }
    });
  };

  return (
    <PublicLayout>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <AdRenderer placement="header" />

        <div className="mt-8 mb-4">
          <Link href={email ? `/inbox/${email.toAddress}` : "/"} className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Inbox
          </Link>
        </div>

        <div className="bg-card border rounded-2xl shadow-sm overflow-hidden min-h-[600px] flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <RefreshCw className="h-8 w-8 text-muted-foreground animate-spin" />
            </div>
          ) : !email ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <p className="text-lg">Email not found</p>
            </div>
          ) : (
            <>
              <div className="p-6 md:p-8 border-b bg-muted/20">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold mb-4">{email.subject || "No Subject"}</h1>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <User className="h-4 w-4" />
                      <span className="font-medium text-foreground">{email.fromAddress}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{new Date(email.receivedAt).toLocaleString()} ({formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })})</span>
                    </div>
                    {email.hasAttachments && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                        <Paperclip className="h-4 w-4" />
                        <span>Has attachments (rendering not supported)</span>
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleDelete} disabled={deleteEmail.isPending} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex-1 p-6 md:p-8 relative">
                <AdRenderer placement="email_body" />
                <div className="mt-6 border rounded-lg overflow-hidden bg-white w-full h-[600px]">
                  <iframe
                    title="Email Content"
                    srcDoc={email.htmlBody || email.textBody || "No content"}
                    sandbox=""
                    className="w-full h-full border-0 bg-white"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
