import { Router, type IRouter } from "express";
import healthRouter from "./health";
import inboxRouter from "./inbox";
import emailsRouter from "./emails";
import domainsRouter from "./domains";
import adsRouter, { publicAdsRouter } from "./ads";
import statsRouter from "./stats";
import { adminAuth } from "../middlewares/admin-auth";

const router: IRouter = Router();

// Public endpoints
router.use(healthRouter);
router.use(inboxRouter);
router.use(publicAdsRouter);

// Admin-only endpoints
router.use(adminAuth);
router.use(emailsRouter);
router.use(domainsRouter);
router.use(adsRouter);
router.use(statsRouter);

export default router;
