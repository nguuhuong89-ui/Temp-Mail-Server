import { Router, type IRouter } from "express";
import { networkInterfaces } from "node:os";
import { checkAdminToken, isAdminAuthConfigured } from "../middlewares/admin-auth";

const router: IRouter = Router();

router.get("/admin/auth/status", (_req, res) => {
  res.json({ required: isAdminAuthConfigured() });
});

router.get("/admin/server-info", (_req, res) => {
  let serverIp: string = process.env["SERVER_IP"] ?? "";
  if (!serverIp) {
    const nets = networkInterfaces();
    outer: for (const ifaces of Object.values(nets)) {
      for (const iface of ifaces ?? []) {
        if (iface.family === "IPv4" && !iface.internal) {
          const ip = iface.address;
          if (!ip.startsWith("172.") && !ip.startsWith("10.") && !ip.startsWith("192.168.")) {
            serverIp = ip;
            break outer;
          }
          if (!serverIp) serverIp = ip;
        }
      }
    }
  }
  res.json({
    serverIp: serverIp || "Unknown",
    smtpPort: Number(process.env["SMTP_PORT"] ?? 25),
    mailDomain: process.env["MAIL_DOMAIN"] ?? "",
  });
});

router.post("/admin/auth/login", (req, res) => {
  const token =
    (typeof req.body?.token === "string" ? req.body.token : "") ||
    req.header("x-admin-token") ||
    "";
  if (!checkAdminToken(token)) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  res.json({ ok: true });
});

export default router;
