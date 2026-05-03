import { AdminLayout } from "@/components/layout/admin-layout";

export default function SetupGuide() {
  return (
    <AdminLayout>
      <div className="space-y-8 max-w-3xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Setup Guide</h1>
          <p className="text-muted-foreground mt-2">How to configure DNS to receive emails for your domains.</p>
        </div>

        <div className="prose dark:prose-invert max-w-none">
          <h3>1. Add your domain</h3>
          <p>
            First, add your domain in the <strong>Domains</strong> tab of this console. You can choose whether it should be publicly available for random generation or kept private.
          </p>

          <h3>2. Configure DNS Records</h3>
          <p>
            To receive emails, you need to tell the internet that this server handles mail for your domain. Add the following records to your domain's DNS settings (e.g., in Cloudflare, Route53, or Namecheap).
          </p>

          <div className="bg-muted p-4 rounded-md border not-prose my-6">
            <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">A Record</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><strong>Type:</strong> A</div>
              <div><strong>Name/Host:</strong> mail</div>
              <div><strong>Value:</strong> <em>&lt;Your Server IP&gt;</em></div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">This points the subdomain mail.yourdomain.com to this server.</p>
          </div>

          <div className="bg-muted p-4 rounded-md border not-prose my-6">
            <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">MX Record</h4>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div><strong>Type:</strong> MX</div>
              <div><strong>Name/Host:</strong> @ (or empty)</div>
              <div><strong>Value:</strong> mail.yourdomain.com</div>
              <div><strong>Priority:</strong> 10</div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">This tells other mail servers to route emails for @yourdomain.com to mail.yourdomain.com.</p>
          </div>

          <div className="bg-muted p-4 rounded-md border not-prose my-6">
            <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">TXT Record (SPF)</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><strong>Type:</strong> TXT</div>
              <div><strong>Name/Host:</strong> @ (or empty)</div>
              <div><strong>Value:</strong> v=spf1 mx -all</div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Optional but recommended. Prevents spam spoofing from your domain.</p>
          </div>

          <h3>3. Verify Configuration</h3>
          <p>
            DNS propagation can take up to 24 hours, but usually happens within minutes. Go back to the <strong>Domains</strong> tab and click "Check DNS" to verify that your MX records are detected by the server.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
