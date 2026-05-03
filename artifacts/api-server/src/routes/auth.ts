import { Router, type IRouter } from "express";
import { checkAdminToken, isAdminAuthConfigured } from "../middlewares/admin-auth";

const router: IRouter = Router();

router.get("/admin/auth/status", (_req, res) => {
  res.json({ required: isAdminAuthConfigured() });
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
