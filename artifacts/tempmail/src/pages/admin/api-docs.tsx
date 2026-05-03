import { AdminLayout } from "@/components/layout/admin-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Key, Bot, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

function CodeBlock({ code }: { code: string }) {
  const { toast } = useToast();
  return (
    <div className="relative group">
      <pre className="bg-muted/50 border rounded-lg p-4 text-xs overflow-x-auto font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => {
          navigator.clipboard.writeText(code);
          toast({ title: "Copied" });
        }}
      >
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}

function Endpoint({
  method,
  path,
  desc,
}: { method: string; path: string; desc: string }) {
  const colors: Record<string, string> = {
    GET: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
    POST: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
    DELETE: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
  };
  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-0">
      <Badge className={`${colors[method]} font-mono`}>{method}</Badge>
      <code className="font-mono text-sm font-medium">{path}</code>
      <span className="text-sm text-muted-foreground ml-auto">{desc}</span>
    </div>
  );
}

export default function ApiDocs() {
  const base = typeof window !== "undefined" ? window.location.origin : "https://your-domain";

  const curlCreate = `curl -X POST ${base}/api/v1/inboxes \\
  -H "X-API-Key: tm_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"ttlMinutes": 30}'`;

  const curlList = `curl ${base}/api/v1/inboxes/abc123@example.com/emails \\
  -H "X-API-Key: tm_live_..."`;

  const curlGet = `curl ${base}/api/v1/inboxes/abc123@example.com/emails/42 \\
  -H "X-API-Key: tm_live_..."`;

  const curlWait = `# Long-poll up to 60s for the next verification code
curl "${base}/api/v1/inboxes/abc123@example.com/wait-for-code?timeout=45&since=$(date -u +%FT%TZ)" \\
  -H "X-API-Key: tm_live_..."
# → {"code":"482910","source":"context","emailId":42,"fromAddress":"...","subject":"...","receivedAt":"..."}`;

  const jsExample = `const API = "${base}/api/v1";
const KEY = process.env.TEMPMAIL_KEY;

// 1. Create a disposable inbox
const inbox = await fetch(\`\${API}/inboxes\`, {
  method: "POST",
  headers: { "X-API-Key": KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ ttlMinutes: 15 }),
}).then(r => r.json());

console.log("Inbox:", inbox.address);
const since = new Date().toISOString();

// 2. Trigger your signup with inbox.address here ...
//    e.g. await signupAt("https://example.com", inbox.address);

// 3. Wait up to 45s for the verification code (single request, no polling).
const res = await fetch(
  \`\${API}/inboxes/\${inbox.address}/wait-for-code?timeout=45&since=\${since}\`,
  { headers: { "X-API-Key": KEY } },
);
if (res.ok) {
  const { code, fromAddress } = await res.json();
  console.log(\`Got code \${code} from \${fromAddress}\`);
} else {
  console.error("No code arrived in time");
}`;

  const pyExample = `import os, datetime, requests

API = "${base}/api/v1"
KEY = os.environ["TEMPMAIL_KEY"]
H = {"X-API-Key": KEY}

inbox = requests.post(f"{API}/inboxes", headers=H, json={"ttlMinutes": 15}).json()
print("Inbox:", inbox["address"])
since = datetime.datetime.utcnow().isoformat() + "Z"

# trigger your signup with inbox["address"] here ...

r = requests.get(
    f"{API}/inboxes/{inbox['address']}/wait-for-code",
    headers=H,
    params={"timeout": 45, "since": since},
    timeout=60,
)
if r.ok:
    data = r.json()
    print(f"Code: {data['code']} (from {data['fromAddress']})")
else:
    print("No code arrived in time")`;

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API for AI Agents</h1>
          <p className="text-muted-foreground mt-2">
            Programmatic access at <code className="font-mono text-sm">/api/v1</code>. Use any HTTP client.{" "}
            <Link href="/admin/api-keys" className="text-primary underline">Manage keys →</Link>
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" /> Authentication
          </h2>
          <p className="text-sm text-muted-foreground">
            Send the key in the <code className="font-mono text-xs">X-API-Key</code> header (or{" "}
            <code className="font-mono text-xs">Authorization: Bearer ...</code>). Keys start with{" "}
            <code className="font-mono text-xs">tm_live_</code>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Endpoints
          </h2>
          <div className="bg-card border rounded-lg p-4">
            <Endpoint method="POST" path="/api/v1/inboxes" desc="Create a disposable inbox" />
            <Endpoint method="GET" path="/api/v1/inboxes/{address}" desc="Get inbox metadata" />
            <Endpoint method="DELETE" path="/api/v1/inboxes/{address}" desc="Delete inbox + all emails" />
            <Endpoint method="GET" path="/api/v1/inboxes/{address}/emails" desc="List incoming emails" />
            <Endpoint method="GET" path="/api/v1/inboxes/{address}/emails/{id}" desc="Get full email body" />
            <Endpoint method="DELETE" path="/api/v1/inboxes/{address}/emails/{id}" desc="Delete a single email" />
            <Endpoint method="GET" path="/api/v1/inboxes/{address}/latest-code" desc="Extract code from recent emails (sync)" />
            <Endpoint method="GET" path="/api/v1/inboxes/{address}/wait-for-code" desc="Long-poll for new verification code" />
            <Endpoint method="GET" path="/api/v1/domains" desc="List active domains" />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" /> Quickstart
          </h2>
          <Tabs defaultValue="curl">
            <TabsList>
              <TabsTrigger value="curl">cURL</TabsTrigger>
              <TabsTrigger value="js">JavaScript</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
            </TabsList>
            <TabsContent value="curl" className="space-y-3 pt-3">
              <p className="text-sm text-muted-foreground">Create a fresh inbox:</p>
              <CodeBlock code={curlCreate} />
              <p className="text-sm text-muted-foreground">List emails received:</p>
              <CodeBlock code={curlList} />
              <p className="text-sm text-muted-foreground">Read full email body:</p>
              <CodeBlock code={curlGet} />
              <p className="text-sm text-muted-foreground">Wait for the next verification code (recommended for signups):</p>
              <CodeBlock code={curlWait} />
            </TabsContent>
            <TabsContent value="js" className="pt-3">
              <CodeBlock code={jsExample} />
            </TabsContent>
            <TabsContent value="python" className="pt-3">
              <CodeBlock code={pyExample} />
            </TabsContent>
          </Tabs>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Tips for agents</h2>
          <ul className="list-disc pl-6 space-y-1.5 text-sm text-muted-foreground">
            <li>
              Prefer <code className="font-mono text-xs">wait-for-code</code> over polling — it long-polls (max 60s) and resolves the moment a matching email arrives. Always pass <code className="font-mono text-xs">since</code> set to the time you triggered the signup, so old codes are ignored.
            </li>
            <li>
              The extractor recognises 4–8 digit OTPs (incl. <code className="font-mono text-xs">123-456</code>) and 6–10 char alphanumeric tokens. Override with <code className="font-mono text-xs">?pattern=\d{"{6}"}</code> if your provider uses an unusual format.
            </li>
            <li>
              Set <code className="font-mono text-xs">ttlMinutes</code> to limit inbox lifetime (1–10080).
            </li>
            <li>
              Pass <code className="font-mono text-xs">localPart</code> + <code className="font-mono text-xs">domain</code> to claim a specific address (returns 409 if taken).
            </li>
            <li>
              Configure a webhook on each domain (Domains page) to push new emails to your service instead of polling.
            </li>
            <li>
              Block known spammers via the Blocklist page so they never hit your inbox or webhook.
            </li>
          </ul>
        </section>
      </div>
    </AdminLayout>
  );
}
