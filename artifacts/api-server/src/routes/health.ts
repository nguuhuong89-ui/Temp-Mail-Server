import { Router, type IRouter } from "express";
import { schemas } from "@workspace/api-zod";
import { getDbInitError } from "../lib/startup-state";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const dbErr = getDbInitError();
  const data = schemas.HealthCheckResponse.parse({ status: "ok" });
  res.json({ ...data, dbInitError: dbErr });
});

export default router;
