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
import accountRouter from "./account";
import webhooksRouter from "./webhooks";
import adminUsersRouter from "./admin-users";
import adminInboxesRouter from "./admin-inboxes";
import adminSettingsRouter from "./admin-settings";
import adminAuditRouter from "./admin-audit";
import adminRateLimitsRouter from "./admin-rate-limits";
import adminHealthRouter from "./admin-health";
import dataExportRouter from "./data-export";
import publicRouter from "./public";
import { adminAuth } from "../middlewares/admin-auth";
import { attachUser } from "../middlewares/clerk-auth";

const router: IRouter = Router();

// Public endpoints (note: inbox routes use attachUser to optionally tag with signed-in user)
router.use(healthRouter);
router.use(publicRouter);
router.use(attachUser, inboxRouter);
router.use(publicAdsRouter);

// Public API for AI agents / external integrations (auth via X-API-Key)
router.use(v1Router);

// Authenticated user (Clerk) endpoints
router.use(accountRouter);
router.use(webhooksRouter);
router.use(dataExportRouter);

// Legacy admin-token endpoints
router.use(adminAuth);
router.use("/admin", adminUsersRouter);
router.use(emailsRouter);
router.use(domainsRouter);
router.use(adsRouter);
router.use(statsRouter);
router.use(blocklistRouter);
router.use(apiKeysRouter);
router.use(adminInboxesRouter);
router.use(adminSettingsRouter);
router.use(adminAuditRouter);
router.use(adminRateLimitsRouter);
router.use(adminHealthRouter);

export default router;
