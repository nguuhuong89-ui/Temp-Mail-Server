import { PublicLayout } from "@/components/layout/public-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Key, Bot, Zap, Lock, Globe, Code2, BookOpen, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

function CopyButton({ text }: { text: string }) {
  const { toast } = useToast();
  return (
    <button
      className="absolute top-3 right-3 h-7 w-7 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
      onClick={() => { navigator.clipboard.writeText(text); toast({ title: "Copied" }); }}
    >
      <Copy className="h-3.5 w-3.5 text-white/70" />
    </button>
  );
}

function CodeBlock({ code, lang = "" }: { code: string; lang?: string }) {
  return (
    <div className="relative group">
      <pre className="bg-black/40 border border-white/10 rounded-xl p-4 text-xs overflow-x-auto font-mono leading-relaxed text-emerald-300/90 scrollbar-thin">
        <code>{code}</code>
      </pre>
      <CopyButton text={code} />
    </div>
  );
}

function Method({ m }: { m: string }) {
  const c: Record<string, string> = {
    GET: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    POST: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    DELETE: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${c[m]}`}>
      {m}
    </span>
  );
}

function Endpoint({ method, path, desc, auth = true, params }: {
  method: string; path: string; desc: string; auth?: boolean;
  params?: { name: string; type: string; required?: boolean; desc: string }[];
}) {
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-white/5">
        <Method m={method} />
        <code className="font-mono text-sm text-white/90 flex-1">{path}</code>
        {!auth && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
            No auth
          </span>
        )}
        <span className="text-xs text-white/50 ml-auto hidden sm:block">{desc}</span>
      </div>
      {params && (
        <div className="divide-y divide-white/5">
          {params.map((p) => (
            <div key={p.name} className="grid grid-cols-[120px_80px_1fr] gap-3 px-4 py-2.5 text-xs items-start">
              <code className="font-mono text-violet-300">{p.name}</code>
              <span className="text-white/40">{p.type}{p.required && <span className="text-rose-400 ml-1">*</span>}</span>
              <span className="text-white/60">{p.desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, color = "text-violet-400" }: {
  icon: React.ElementType; title: string; color?: string;
}) {
  return (
    <h2 className="text-xl font-bold flex items-center gap-2.5 text-white">
      <div className={`h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      {title}
    </h2>
  );
}

export default function DocsPage() {
  const base = typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";

  const curlCreate = `curl -X POST ${base}/api/v1/inboxes \\
  -H "X-API-Key: tm_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"ttlMinutes": 30}'`;

  const curlWait = `curl "${base}/api/v1/inboxes/abc123@mail.example.com/wait-for-code?timeout=45&since=$(date -u +%FT%TZ)" \\
  -H "X-API-Key: tm_live_..."

# Response:
# {"code":"482910","emailId":42,"subject":"Verify your email","receivedAt":"..."}`;

  const curlTotp = `curl "${base}/api/totp?secret=JBSWY3DPEHPK3PXP"

# Response:
# {"code":"123456","remainingSeconds":17,"period":30}`;

  const jsExample = `const API = "${base}/api/v1";
const KEY = process.env.TEMPMAIL_KEY; // tm_live_...

// 1. Create a disposable inbox (30 min TTL)
const inbox = await fetch(\`\${API}/inboxes\`, {
  method: "POST",
  headers: { "X-API-Key": KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ ttlMinutes: 30 }),
}).then(r => r.json());

console.log("Inbox:", inbox.address);
const since = new Date().toISOString();

// 2. Trigger signup using inbox.address as the email ...

// 3. Long-poll for verification code (single request, no polling loop)
const res = await fetch(
  \`\${API}/inboxes/\${inbox.address}/wait-for-code?timeout=45&since=\${since}\`,
  { headers: { "X-API-Key": KEY } }
);
if (res.ok) {
  const { code } = await res.json();
  console.log("Code:", code); // "482910"
}`;

  const pyExample = `import os, datetime, requests

API = "${base}/api/v1"
KEY = os.environ["TEMPMAIL_KEY"]  # tm_live_...
H   = {"X-API-Key": KEY}

# 1. Create inbox
inbox = requests.post(f"{API}/inboxes", headers=H,
                      json={"ttlMinutes": 30}).json()
print("Inbox:", inbox["address"])
since = datetime.datetime.utcnow().isoformat() + "Z"

# 2. Trigger signup with inbox["address"] ...

# 3. Wait up to 45 s for the code
r = requests.get(
    f"{API}/inboxes/{inbox['address']}/wait-for-code",
    headers=H, params={"timeout": 45, "since": since},
    timeout=60,
)
if r.ok:
    print("Code:", r.json()["code"])`;

  return (
    <PublicLayout>
      <div className="container max-w-4xl mx-auto px-4 py-12 space-y-14">

        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-medium">
            <Code2 className="h-3.5 w-3.5" /> REST API
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
            API Documentation
          </h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto leading-relaxed">
            Programmatic access to disposable inboxes. Perfect for QA automation,
            AI agents, and CI/CD pipelines that need real email delivery.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link href="/account/api-keys">
              <Button className="bg-violet-600 hover:bg-violet-500 text-white border-0 shadow-lg shadow-violet-500/30 gap-2">
                <Key className="h-4 w-4" /> Get API Key
              </Button>
            </Link>
            <a href="https://github.com/nguuhuong89-ui/Temp-Mail-Server" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="border-white/20 text-white/70 hover:text-white hover:bg-white/10 gap-2">
                <ExternalLink className="h-4 w-4" /> GitHub
              </Button>
            </a>
          </div>
        </div>

        {/* Auth */}
        <section className="space-y-4">
          <SectionTitle icon={Lock} title="Authentication" color="text-amber-400" />
          <p className="text-white/60 text-sm">
            Include your API key in every request. Keys begin with <code className="font-mono text-violet-300 text-xs bg-white/10 px-1.5 py-0.5 rounded">tm_live_</code>.
            Get one from your <Link href="/account/api-keys" className="text-violet-400 hover:underline">account settings</Link>.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { label: "Header (recommended)", code: "X-API-Key: tm_live_your_key_here" },
              { label: "Bearer token", code: "Authorization: Bearer tm_live_your_key_here" },
            ].map(({ label, code }) => (
              <div key={label} className="space-y-1.5">
                <p className="text-xs text-white/40">{label}</p>
                <CodeBlock code={code} />
              </div>
            ))}
          </div>
        </section>

        {/* Endpoints */}
        <section className="space-y-4">
          <SectionTitle icon={Zap} title="Endpoints" color="text-sky-400" />

          <div className="space-y-2">
            <p className="text-xs text-white/40 uppercase tracking-wider pb-1">Inboxes</p>
            <Endpoint method="POST" path="/api/v1/inboxes" desc="Create a disposable inbox"
              params={[
                { name: "localPart", type: "string", desc: "Custom local part (e.g. mybox). Omit for random." },
                { name: "domainId", type: "number", desc: "Domain ID from /api/v1/domains. Omit for default." },
                { name: "ttlMinutes", type: "number", desc: "Inbox lifetime 1–10080 (default 1440 = 24h)." },
              ]}
            />
            <Endpoint method="GET"    path="/api/v1/inboxes" desc="List your inboxes" />
            <Endpoint method="GET"    path="/api/v1/inboxes/:address" desc="Get inbox metadata" />
            <Endpoint method="DELETE" path="/api/v1/inboxes/:address" desc="Delete inbox + all emails" />
          </div>

          <div className="space-y-2">
            <p className="text-xs text-white/40 uppercase tracking-wider pb-1">Emails</p>
            <Endpoint method="GET"    path="/api/v1/inboxes/:address/emails" desc="List received emails"
              params={[{ name: "limit", type: "number", desc: "1–100, default 20." }]}
            />
            <Endpoint method="GET"    path="/api/v1/inboxes/:address/emails/:id" desc="Get full email (subject, text, html)" />
            <Endpoint method="DELETE" path="/api/v1/inboxes/:address/emails/:id" desc="Delete a single email" />
          </div>

          <div className="space-y-2">
            <p className="text-xs text-white/40 uppercase tracking-wider pb-1">Code extraction</p>
            <Endpoint method="GET" path="/api/v1/inboxes/:address/latest-code" desc="Extract code from recent emails (instant)"
              params={[
                { name: "lookback", type: "number", desc: "Emails to scan, 1–50 (default 5)." },
                { name: "pattern",  type: "string",  desc: "Custom regex override, e.g. \\d{6}." },
              ]}
            />
            <Endpoint method="GET" path="/api/v1/inboxes/:address/wait-for-code" desc="Long-poll up to 60 s for a new code"
              params={[
                { name: "timeout", type: "number", desc: "Max wait seconds, 1–60 (default 30)." },
                { name: "since",   type: "ISO 8601", desc: "Only consider emails after this timestamp." },
                { name: "pattern", type: "string",  desc: "Custom regex override." },
              ]}
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs text-white/40 uppercase tracking-wider pb-1">Utilities</p>
            <Endpoint method="GET" path="/api/v1/domains" desc="List public domains available for inboxes" />
            <Endpoint method="GET" path="/api/totp" auth={false} desc="Generate TOTP code from a secret (no auth required)"
              params={[
                { name: "secret", type: "string", required: true, desc: "Base32 secret or otpauth:// URI." },
              ]}
            />
          </div>
        </section>

        {/* Quickstart */}
        <section className="space-y-4">
          <SectionTitle icon={Bot} title="Quickstart Examples" color="text-emerald-400" />
          <Tabs defaultValue="js">
            <TabsList className="bg-white/10 border border-white/10">
              <TabsTrigger value="js" className="data-[state=active]:bg-white/20 text-white/70 data-[state=active]:text-white">JavaScript</TabsTrigger>
              <TabsTrigger value="python" className="data-[state=active]:bg-white/20 text-white/70 data-[state=active]:text-white">Python</TabsTrigger>
              <TabsTrigger value="curl" className="data-[state=active]:bg-white/20 text-white/70 data-[state=active]:text-white">cURL</TabsTrigger>
              <TabsTrigger value="totp" className="data-[state=active]:bg-white/20 text-white/70 data-[state=active]:text-white">TOTP</TabsTrigger>
            </TabsList>
            <TabsContent value="js" className="pt-3">
              <CodeBlock code={jsExample} />
            </TabsContent>
            <TabsContent value="python" className="pt-3">
              <CodeBlock code={pyExample} />
            </TabsContent>
            <TabsContent value="curl" className="space-y-4 pt-3">
              <p className="text-xs text-white/40">Create inbox</p>
              <CodeBlock code={curlCreate} />
              <p className="text-xs text-white/40">Wait for verification code</p>
              <CodeBlock code={curlWait} />
            </TabsContent>
            <TabsContent value="totp" className="space-y-3 pt-3">
              <p className="text-sm text-white/60">
                Generate a TOTP code from a 2FA secret — no API key required.
                Useful for automating logins that require 2FA.
              </p>
              <CodeBlock code={curlTotp} />
            </TabsContent>
          </Tabs>
        </section>

        {/* Tips */}
        <section className="space-y-4">
          <SectionTitle icon={Globe} title="Tips for AI agents & automation" color="text-rose-400" />
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              {
                title: "Use wait-for-code, not polling",
                desc: "It long-polls (up to 60 s) and returns the instant a matching email arrives. Pass since= set to the moment before you triggered the signup so old codes are ignored.",
              },
              {
                title: "Smart code extraction",
                desc: "The extractor finds 4–8 digit OTPs (incl. 123-456 split formats) and 6–10 char alphanumeric tokens. Override with ?pattern=\\d{6} for unusual formats.",
              },
              {
                title: "Claim specific addresses",
                desc: "Pass localPart + domainId to POST /inboxes to get a predictable address. Returns 409 if already taken — retry with a different name.",
              },
              {
                title: "Webhooks for high-throughput",
                desc: "Configure a webhook URL on each domain in the admin panel. New emails are pushed to your endpoint the moment they arrive — no polling needed.",
              },
              {
                title: "Inbox isolation",
                desc: "API-key–owned inboxes are completely hidden from the public unauthenticated API. A consistent 404 is returned for any access attempt (no existence oracle).",
              },
              {
                title: "TTL management",
                desc: "Set ttlMinutes=10 for short-lived test runs, or up to 10080 (7 days) for longer workflows. Delete the inbox explicitly when done to keep things clean.",
              },
            ].map(({ title, desc }) => (
              <div key={title} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-1.5">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="text-xs text-white/55 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="rounded-2xl bg-gradient-to-br from-violet-600/30 to-indigo-600/20 border border-violet-500/30 p-8 text-center space-y-4">
          <h3 className="text-xl font-bold text-white">Ready to start?</h3>
          <p className="text-white/60 text-sm">
            Create a free account, upgrade to Pro, and get your API key in seconds.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/sign-up">
              <Button className="bg-violet-600 hover:bg-violet-500 text-white border-0 shadow-lg shadow-violet-500/30 gap-2">
                Sign up free
              </Button>
            </Link>
            <Link href="/account/plan">
              <Button variant="outline" className="border-white/20 text-white/70 hover:text-white hover:bg-white/10 gap-2">
                View Pro plan
              </Button>
            </Link>
          </div>
        </div>

      </div>
    </PublicLayout>
  );
}
