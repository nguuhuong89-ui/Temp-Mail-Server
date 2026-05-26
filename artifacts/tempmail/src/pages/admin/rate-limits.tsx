import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Shield, Activity } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

type RateLimitConfig = { maxRequests: number; windowMs?: number };
type RateLimitStat = { key: string; action: string; count: number; windowStart: number };
type RateLimitData = { limits: Record<string, RateLimitConfig>; stats: RateLimitStat[] };

export default function AdminRateLimits() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editLimits, setEditLimits] = useState<Record<string, RateLimitConfig>>({});

  const { data, isLoading, isFetching, refetch } = useQuery<RateLimitData>({
    queryKey: ["/admin/rate-limits"],
    queryFn: () => apiFetch<RateLimitData>("/api/admin/rate-limits"),
    refetchInterval: 10_000,
  });

  useEffect(() => {
    if (data?.limits) setEditLimits(data.limits);
  }, [data?.limits]);

  const save = useMutation({
    mutationFn: () =>
      apiFetch("/api/admin/rate-limits", {
        method: "PUT",
        body: JSON.stringify({ limits: editLimits }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/admin/rate-limits"] });
      toast({ title: "Rate limits updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6" /> Rate Limits
            </h1>
            <p className="text-muted-foreground text-sm">Configure and monitor rate limiting</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (
          <>
            {/* Limit configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Limits Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(editLimits).map(([action, config]) => (
                    <div key={action} className="flex items-center gap-3">
                      <Badge variant="outline" className="min-w-[120px] justify-center font-mono text-xs">{action}</Badge>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-20">Max req:</span>
                        <Input
                          type="number"
                          className="w-24 h-8 text-sm"
                          value={config.maxRequests}
                          onChange={(e) =>
                            setEditLimits((prev) => ({
                              ...prev,
                              [action]: { ...prev[action], maxRequests: Number(e.target.value) || 1 },
                            }))
                          }
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-20">Window ms:</span>
                        <Input
                          type="number"
                          className="w-24 h-8 text-sm"
                          value={config.windowMs ?? 60000}
                          onChange={(e) =>
                            setEditLimits((prev) => ({
                              ...prev,
                              [action]: { ...prev[action], windowMs: Number(e.target.value) || 60000 },
                            }))
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <Button className="mt-4" size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
                  Save Limits
                </Button>
              </CardContent>
            </Card>

            {/* Live stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Live Request Stats (Top 100)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!data?.stats?.length ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No rate limit activity</p>
                ) : (
                  <div className="space-y-1 max-h-[400px] overflow-y-auto">
                    <div className="grid grid-cols-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-2 border-b">
                      <span>Action</span>
                      <span>Key</span>
                      <span className="text-right">Count</span>
                      <span className="text-right">Window</span>
                    </div>
                    {data.stats.map((s, i) => {
                      const limit = data.limits[s.action]?.maxRequests ?? 999;
                      const overLimit = s.count > limit;
                      return (
                        <div key={i} className={`grid grid-cols-4 text-xs py-1.5 border-b border-slate-50 dark:border-slate-800 ${overLimit ? "text-red-500" : ""}`}>
                          <Badge variant={overLimit ? "destructive" : "secondary"} className="text-[10px] h-5 w-fit">{s.action}</Badge>
                          <span className="font-mono truncate">{s.key}</span>
                          <span className="text-right font-bold">{s.count}</span>
                          <span className="text-right text-muted-foreground">
                            {Math.round((Date.now() - s.windowStart) / 1000)}s ago
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
