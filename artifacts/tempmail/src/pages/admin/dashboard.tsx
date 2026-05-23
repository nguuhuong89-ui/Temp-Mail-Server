import { AdminLayout } from "@/components/layout/admin-layout";
import { useGetDashboardStats, useGetRecentActivity, useGetEmailTimeseries } from "@workspace/api-client-react";
import { Mail, Globe, Users, Megaphone, Activity, TrendingUp, Inbox } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatDistanceToNow } from "date-fns";

type StatsData = {
  totalEmails: number;
  emailsToday: number;
  activeInboxes: number;
  activeDomains: number;
  totalDomains: number;
  activeAds: number;
  totalAds: number;
};

const STAT_CARDS: {
  key: string;
  label: string;
  icon: React.ElementType;
  color: string;
  shadow: string;
  getValue: (s: StatsData) => string;
  getSub: (s: StatsData) => string;
}[] = [
  {
    key: "emails",
    label: "Total Emails",
    icon: Mail,
    color: "from-violet-500 to-purple-600",
    shadow: "shadow-violet-500/20",
    getValue: (s) => s.totalEmails.toLocaleString(),
    getSub: (s) => `+${s.emailsToday.toLocaleString()} hôm nay`,
  },
  {
    key: "inboxes",
    label: "Active Inboxes",
    icon: Inbox,
    color: "from-indigo-500 to-blue-600",
    shadow: "shadow-indigo-500/20",
    getValue: (s) => s.activeInboxes.toLocaleString(),
    getSub: () => "đang hoạt động",
  },
  {
    key: "domains",
    label: "Domains",
    icon: Globe,
    color: "from-sky-500 to-cyan-600",
    shadow: "shadow-sky-500/20",
    getValue: (s) => `${s.activeDomains} Active`,
    getSub: (s) => `${s.totalDomains} tổng cộng`,
  },
  {
    key: "ads",
    label: "Ad Campaigns",
    icon: Megaphone,
    color: "from-amber-500 to-orange-500",
    shadow: "shadow-amber-500/20",
    getValue: (s) => s.activeAds.toString(),
    getSub: (s) => `${s.totalAds} chiến dịch`,
  },
];

const ACTIVITY_COLORS: Record<string, string> = {
  inbox: "bg-violet-500/20 text-violet-400",
  domain: "bg-sky-500/20 text-sky-400",
  email: "bg-emerald-500/20 text-emerald-400",
};

function getActivityColor(msg: string) {
  if (msg.toLowerCase().includes("inbox")) return ACTIVITY_COLORS.inbox;
  if (msg.toLowerCase().includes("domain")) return ACTIVITY_COLORS.domain;
  return ACTIVITY_COLORS.email;
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();
  const { data: timeseries, isLoading: timeseriesLoading } = useGetEmailTimeseries();

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Tổng quan hệ thống TempMail của bạn.</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            SMTP Online
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STAT_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.key} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className={`h-1 bg-gradient-to-r ${card.color}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{card.label}</p>
                      {statsLoading ? (
                        <>
                          <div className="h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mt-1" />
                          <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse mt-2" />
                        </>
                      ) : (
                        <>
                          <p className="text-2xl font-bold mt-1">{stats ? card.getValue(stats as StatsData) : "—"}</p>
                          {stats && <p className="text-xs text-muted-foreground mt-1">{card.getSub(stats as StatsData)}</p>}
                        </>
                      )}
                    </div>
                    <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg ${card.shadow}`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Charts row */}
        <div className="grid gap-4 lg:grid-cols-7">
          {/* Bar chart */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-violet-500" />
              <h2 className="font-semibold text-sm">Email Volume (24h)</h2>
            </div>
            <div className="p-4 h-[280px]">
              {timeseriesLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="w-full h-full bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                </div>
              ) : timeseries && timeseries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeseries} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground)/0.1)" />
                    <XAxis
                      dataKey="hour"
                      tickFormatter={(v) => new Date(v).getHours().toString().padStart(2, "0") + "h"}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      dy={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      labelFormatter={(v) => new Date(v).toLocaleTimeString()}
                      cursor={{ fill: "hsl(var(--muted-foreground)/0.08)" }}
                    />
                    <Bar dataKey="count" fill="url(#barGrad)" radius={[4, 4, 0, 0]} />
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7c3aed" />
                        <stop offset="100%" stopColor="#4f46e5" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Mail className="h-8 w-8 opacity-20" />
                  <span className="text-sm">Chưa có email trong 24h qua.</span>
                </div>
              )}
            </div>
          </div>

          {/* Recent activity */}
          <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 shrink-0">
              <Activity className="h-4 w-4 text-indigo-500" />
              <h2 className="font-semibold text-sm">Recent Activity</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {activityLoading && Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="h-7 w-7 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                      <div className="h-2.5 w-1/3 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
                {!activityLoading && activity?.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${getActivityColor(item.message)}`}>
                      <Activity className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-snug text-slate-700 dark:text-slate-300">{item.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
                {!activity?.length && (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    Chưa có hoạt động.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
