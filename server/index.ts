import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import passport from "passport";
import ConnectPgSimple from "connect-pg-simple";
import { Pool } from "@neondatabase/serverless";
import path from "path";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedData } from "./seed-data";
import { setupAuth, setupAuthRoutes } from "./auth";
import { createMLSGridClient } from "./mlsgrid-client";
import { startMLSGridScheduledSync, triggerManualSync } from "./mlsgrid-sync";
import { startEmailScheduler } from "./email-scheduler";
import { startRepliersScheduledSync, registerRepliersSyncRoutes, triggerRepliersSync } from "./repliers-sync";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { validateConfig } from "./config";
import { logger, requestIdMiddleware } from "./logger";

const config = validateConfig();

const app = express();
const isProduction = config.NODE_ENV === "production";

app.set("trust proxy", isProduction ? 1 : false);

app.use(requestIdMiddleware);

app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors 'self' https://*.replit.dev https://*.replit.app https://*.onrender.com https://*.spyglassrealty.com"
  );
  res.removeHeader("X-Frame-Options");
  next();
});

app.use(express.static(path.join(process.cwd(), "public")));

app.use(cookieParser());

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
  skip: (req) => {
    if (req.path === "/health") return true;
    if (req.path.startsWith("/auth/")) return true;
    return false;
  },
});
app.use("/api/", apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts, please try again later" },
});
app.use("/auth/", authLimiter);

const PgSession = ConnectPgSimple(session);

const dbPool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    })
  : null;

const sessionStore = dbPool
  ? new PgSession({
      pool: dbPool,
      createTableIfMissing: true,
    })
  : undefined;

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "development-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction,
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

setupAuth();
setupAuthRoutes(app);

app.get("/health", async (_req, res) => {
  const checks: Record<string, string> = {};

  if (dbPool) {
    try {
      await dbPool.query("SELECT 1");
      checks.database = "ok";
    } catch {
      checks.database = "error";
    }
  } else {
    checks.database = "not_configured";
  }

  checks.repliers = process.env.REPLIERS_API_KEY ? "configured" : "not_configured";
  checks.google_oauth =
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? "configured"
      : "not_configured";

  const allOk = checks.database !== "error";

  res.status(allOk ? 200 : 503).json({
    status: allOk ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: config.NODE_ENV,
    checks,
  });
});

app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api")) {
      let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const mlsGridClient = createMLSGridClient();

  if (mlsGridClient && process.env.DATABASE_URL) {
    logger.info("MLS Grid API configured - enabling scheduled sync");
    startMLSGridScheduledSync(mlsGridClient);
  } else if (!process.env.MLSGRID_API_TOKEN) {
    await seedData();
  }

  if (process.env.DATABASE_URL) {
    logger.info("Starting email scheduler for seller updates");
    startEmailScheduler();
  }

  logger.info("Starting Repliers inventory scheduled sync");
  startRepliersScheduledSync();

  registerRepliersSyncRoutes(app);
  registerObjectStorageRoutes(app);

  const server = await registerRoutes(app);

  triggerRepliersSync().catch((err) => {
    logger.warn("Initial Repliers inventory sync failed", { error: err.message });
  });

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    logger.error("Unhandled error", {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status,
      error: message,
      stack: isProduction ? undefined : err.stack,
    });

    if (!res.headersSent) {
      res.status(status).json({
        message: isProduction && status >= 500
          ? "An unexpected error occurred"
          : message,
        requestId: req.requestId,
      });
    }
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      logger.info(`Server listening on port ${port}`);
      log(`serving on port ${port}`);
    }
  );

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully`);

    server.close(() => {
      logger.info("HTTP server closed");
    });

    if (dbPool) {
      try {
        await dbPool.end();
        logger.info("Database pool closed");
      } catch (err: any) {
        logger.error("Error closing database pool", { error: err.message });
      }
    }

    setTimeout(() => {
      logger.warn("Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
})();
