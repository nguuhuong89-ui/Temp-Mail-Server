import { AdminLayout } from "@/components/layout/admin-layout";
import { Globe, Server, Mail, CheckCircle2, Terminal } from "lucide-react";
import { useEffect, useState } from "react";

function DnsBlock({ title, icon: Icon, color, rows }: {
  title: string;
  icon: React.ElementType;
  color: string;
  rows: { label: string; value: string }[];
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className={`px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5 ${color}`}>
        <Icon className="h-4 w-4" />
        <span className="font-semibold text-sm">{title}</span>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[120px_1fr] gap-4 px-5 py-3 text-sm">
            <span className="text-muted-foreground font-medium">{row.label}</span>
            <code className="font-mono text-foreground">{row.value}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

function useServerInfo() {
  const [info, setInfo] = useState<{ serverIp: string; smtpPort: number; mailDomain: string } | null>(null);
  useEffect(() => {
    fetch("/api/admin/server-info")
      .then((r) => r.json())
      .then((d) => setInfo(d))
      .catch(() => {});
  }, []);
  return info;
}

export default function SetupGuide() {
  const info = useServerInfo();
  const serverIp = info?.serverIp ?? "Loading...";
  const mailDomain = info?.mailDomain ?? "mail.yourdomain.com";

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Setup Guide</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Hướng dẫn cấu hình DNS để nhận email cho domain của bạn.</p>
        </div>

        {/* Steps */}
        <div className="space-y-6">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">1</div>
              <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 mt-2" />
            </div>
            <div className="pb-6 flex-1">
              <h2 className="font-semibold mb-2 flex items-center gap-2">
                <Globe className="h-4 w-4 text-violet-500" /> Thêm domain
              </h2>
              <p className="text-sm text-muted-foreground">
                Vào tab <strong className="text-foreground">Domains</strong> trong console này và thêm domain của bạn. Chọn Public nếu muốn cho phép tạo inbox ngẫu nhiên, hoặc Private nếu chỉ dùng nội bộ.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">2</div>
              <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 mt-2" />
            </div>
            <div className="pb-6 flex-1 space-y-4">
              <div>
                <h2 className="font-semibold mb-2 flex items-center gap-2">
                  <Server className="h-4 w-4 text-indigo-500" /> Cấu hình DNS Records
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Thêm các record sau vào DNS settings của domain (Cloudflare, Route53, Namecheap, v.v.):
                </p>
              </div>

              <DnsBlock
                title="A Record — trỏ subdomain về server"
                icon={Server}
                color="text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/30"
                rows={[
                  { label: "Type", value: "A" },
                  { label: "Name/Host", value: "mail" },
                  { label: "Value", value: serverIp },
                  { label: "TTL", value: "300 (hoặc Auto)" },
                ]}
              />

              <DnsBlock
                title="MX Record — định tuyến email đến server"
                icon={Mail}
                color="text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/30"
                rows={[
                  { label: "Type", value: "MX" },
                  { label: "Name/Host", value: "@ (hoặc để trống)" },
                  { label: "Value", value: mailDomain },
                  { label: "Priority", value: "10" },
                ]}
              />

              <DnsBlock
                title="TXT Record — SPF (khuyến nghị)"
                icon={CheckCircle2}
                color="text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/30"
                rows={[
                  { label: "Type", value: "TXT" },
                  { label: "Name/Host", value: "@ (hoặc để trống)" },
                  { label: "Value", value: "v=spf1 mx -all" },
                ]}
              />
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">3</div>
            </div>
            <div className="flex-1">
              <h2 className="font-semibold mb-2 flex items-center gap-2">
                <Terminal className="h-4 w-4 text-sky-500" /> Kiểm tra cấu hình
              </h2>
              <p className="text-sm text-muted-foreground">
                DNS propagation có thể mất đến 24h nhưng thường chỉ vài phút. Quay lại tab <strong className="text-foreground">Domains</strong> và nhấn <strong className="text-foreground">"DNS"</strong> để xác nhận MX record đã được nhận diện đúng.
              </p>
              <div className="mt-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs text-muted-foreground">
                # Kiểm tra thủ công qua terminal:<br />
                $ dig MX yourdomain.com +short<br />
                10 {mailDomain}.
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
