import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import os from "node:os";

const router: IRouter = Router();

const startedAt = Date.now();

router.get("/system-health", async (_req, res) => {
  const uptimeSeconds = Math.round((Date.now() - startedAt) / 1000);
  const memUsage = process.memoryUsage();
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  let dbStatus = "ok";
  let dbLatencyMs = 0;
  let dbConnections = 0;
  try {
    const t0 = Date.now();
    const [connRow] = await Promise.all([
      db.execute(sql`SELECT count(*)::int AS active FROM pg_stat_activity WHERE datname = current_database()`),
      db.execute(sql`SELECT 1`),
    ]);
    dbLatencyMs = Date.now() - t0;
    dbConnections = Number((connRow.rows as Array<{ active: number }>)[0]?.active ?? 0);
  } catch {
    dbStatus = "error";
  }

  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  res.json({
    status: dbStatus === "ok" ? "healthy" : "degraded",
    uptime: uptimeSeconds,
    startedAt: new Date(startedAt).toISOString(),
    system: {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      cpuCount: cpus.length,
      loadAvg: { "1m": loadAvg[0], "5m": loadAvg[1], "15m": loadAvg[2] },
      memory: {
        totalMb: Math.round(totalMem / 1048576),
        freeMb: Math.round(freeMem / 1048576),
        usedPercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
    },
    process: {
      pid: process.pid,
      heapUsedMb: Math.round(memUsage.heapUsed / 1048576),
      heapTotalMb: Math.round(memUsage.heapTotal / 1048576),
      rssMb: Math.round(memUsage.rss / 1048576),
      externalMb: Math.round(memUsage.external / 1048576),
    },
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
      activeConnections: dbConnections,
    },
  });
});

export default router;
