import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Server, Database, Cpu, HardDrive, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";

type HealthData = {
  status: "healthy" | "degraded";
  uptime: number;
  startedAt: string;
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
    cpuCount: number;
    loadAvg: { "1m": number; "5m": number; "15m": number };
    memory: { totalMb: number; freeMb: number; usedPercent: number };
  };
  process: {
    pid: number;
    heapUsedMb: number;
    heapTotalMb: number;
    rssMb: number;
    externalMb: number;
  };
  database: {
    status: string;
    latencyMs: number;
    activeConnections: number;
  };
};

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

export default function SystemHealth() {
  const { data, isLoading, refetch, isFetching } = useQuery<HealthData>({
    queryKey: ["/admin/system-health"],
    queryFn: () => apiFetch<HealthData>("/api/admin/system-health"),
    refetchInterval: 15_000,
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">System Health</h1>
            <p className="text-muted-foreground text-sm">Real-time server monitoring</p>
          </div>
          <div className="flex items-center gap-3">
            {data && (
              <Badge variant={data.status === "healthy" ? "default" : "destructive"} className="text-sm py-1 px-3">
                {data.status === "healthy" ? "● Healthy" : "● Degraded"}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading health data...</p>
        ) : data ? (
          <>
            {/* Top stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Uptime</p>
                      <p className="text-lg font-bold">{formatUptime(data.uptime)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-emerald-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">DB Latency</p>
                      <p className="text-lg font-bold">{data.database.latencyMs}ms</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <HardDrive className="h-5 w-5 text-amber-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Memory Used</p>
                      <p className="text-lg font-bold">{data.system.memory.usedPercent}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <Cpu className="h-5 w-5 text-violet-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Load Avg (1m)</p>
                      <p className="text-lg font-bold">{data.system.loadAvg["1m"].toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detail cards */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Server className="h-4 w-4" /> System
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <Row label="Platform" value={`${data.system.platform} ${data.system.arch}`} />
                  <Row label="Node.js" value={data.system.nodeVersion} />
                  <Row label="CPUs" value={String(data.system.cpuCount)} />
                  <Row label="Total Memory" value={`${data.system.memory.totalMb} MB`} />
                  <Row label="Free Memory" value={`${data.system.memory.freeMb} MB`} />
                  <Row label="Load 5m / 15m" value={`${data.system.loadAvg["5m"].toFixed(2)} / ${data.system.loadAvg["15m"].toFixed(2)}`} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Cpu className="h-4 w-4" /> Process
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <Row label="PID" value={String(data.process.pid)} />
                  <Row label="Heap Used" value={`${data.process.heapUsedMb} MB`} />
                  <Row label="Heap Total" value={`${data.process.heapTotalMb} MB`} />
                  <Row label="RSS" value={`${data.process.rssMb} MB`} />
                  <Row label="External" value={`${data.process.externalMb} MB`} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Database className="h-4 w-4" /> Database
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <Row label="Status" value={data.database.status} />
                  <Row label="Latency" value={`${data.database.latencyMs} ms`} />
                  <Row label="Active Connections" value={String(data.database.activeConnections)} />
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
