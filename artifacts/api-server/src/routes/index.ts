import { Router, type IRouter } from "express";
import healthRouter from "./health";
import inboxRouter from "./inbox";
import emailsRouter from "./emails";
import domainsRouter from "./domains";
import adsRouter, { publicAdsRouter } from "./ads";
import statsRouter from "./stats";
import blocklistRouter from "./blocklist";
import v1Router from "./v1";
import apiKeysRouter from "./api-keys";
import { adminAuth } from "../middlewares/admin-auth";

const router: IRouter = Router();

// Public endpoints
router.use(healthRouter);
router.use(inboxRouter);
router.use(publicAdsRouter);

// Public API for AI agents / external integrations (auth via X-API-Key)
router.use(v1Router);

// Admin-only endpoints
router.use(adminAuth);
router.use(emailsRouter);
router.use(domainsRouter);
router.use(adsRouter);
router.use(statsRouter);
router.use(blocklistRouter);
router.use(apiKeysRouter);

export default router;
