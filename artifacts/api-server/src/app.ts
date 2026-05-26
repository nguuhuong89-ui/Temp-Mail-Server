import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import authRouter from "./routes/auth";
import { logger } from "./lib/logger";

const app: Express = express();
app.set("trust proxy", 1);
app.set("etag", "weak");

app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => {
        const url = (req as { url?: string }).url ?? "";
        return url === "/api/health" || url.endsWith("/stream");
      },
    },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors());
app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.path.endsWith("/stream")) return false;
      return compression.filter(req, res);
    },
  }),
);
// Only parse body for methods that carry a body — skip for GET/HEAD/DELETE
// to avoid unnecessary buffering overhead on read-heavy paths.
const jsonParser = express.json({ limit: "256kb" });
const urlencodedParser = express.urlencoded({ extended: true, limit: "256kb" });
app.use((req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD") {
    next();
    return;
  }
  jsonParser(req, res, (err?: unknown) => {
    if (err) { next(err); return; }
    urlencodedParser(req, res, next);
  });
});

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env["CLERK_PUBLISHABLE_KEY"],
    ),
  })),
);

const inboxLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests, slow down." },
});
app.use("/api/inbox/random", inboxLimiter);
app.use("/api/inbox/custom", inboxLimiter);

app.use("/api", authRouter);
app.use("/api", router);

// Error handler — returns JSON; hides internal details in production.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error({ err }, "Unhandled request error");
  const isProduction = process.env.NODE_ENV === "production";
  res.status(500).json({
    error: "Internal server error",
    ...(isProduction ? {} : { detail: message }),
  });
});

export default app;
