import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import passport from "passport";
import ConnectPgSimple from "connect-pg-simple";
import { Pool } from "@neondatabase/serverless";
import path from "path";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./vite";
import { seedData } from "./seed-data";
import { setupAuth, setupAuthRoutes } from "./auth";
import { createMLSGridClient } from "./mlsgrid-client";
import { triggerManualSync } from "./mlsgrid-sync";
import { processScheduledEmails } from "./email-scheduler";
import { triggerRepliersSync, registerRepliersSyncRoutes } from "./repliers-sync";

const app = express();

// Trust proxy - required for secure cookies behind reverse proxies (Vercel/Render)
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);

// CSP Headers for iframe embedding (Mission Control / Agent Hub Portal)
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'self' https://*.onrender.com https://*.spyglassrealty.com https://*.vercel.app"
  );
  res.removeHeader('X-Frame-Options');
  next();
});

// Serve static files from public folder (logos, widget JS, etc.)
app.use(express.static(path.join(process.cwd(), 'public')));

// Cookie parser for lead gate tracking
app.use(cookieParser());

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// Configure production-ready session store
const PgSession = ConnectPgSimple(session);

// In production, always require a persistent session store
if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for production session storage");
}

const sessionStore = process.env.DATABASE_URL 
  ? new PgSession({
      pool: new Pool({ 
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      }),
      createTableIfMissing: true,
    })
  : undefined;

const isProduction = process.env.NODE_ENV === 'production';

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

// Health check endpoint for Vercel, Render, and load balancers
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Vercel Cron Endpoints ───────────────────────────────────────────────────
// These are hit by Vercel Cron on a schedule. Protected by CRON_SECRET.

function verifyCronSecret(req: Request, res: Response, next: NextFunction) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // If no secret configured, allow (dev mode)
    return next();
  }
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.post('/api/cron/mls-sync', verifyCronSecret, async (_req: Request, res: Response) => {
  try {
    console.log('🔄 [Cron] MLS Grid sync triggered');
    const mlsGridClient = createMLSGridClient();
    if (!mlsGridClient) {
      return res.status(200).json({ status: 'skipped', message: 'MLS Grid API not configured' });
    }
    await triggerManualSync();
    res.status(200).json({ status: 'ok', message: 'MLS Grid sync completed' });
  } catch (error: any) {
    console.error('❌ [Cron] MLS Grid sync failed:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.post('/api/cron/repliers-sync', verifyCronSecret, async (_req: Request, res: Response) => {
  try {
    console.log('🔄 [Cron] Repliers inventory sync triggered');
    const status = await triggerRepliersSync();
    res.status(200).json({ status: 'ok', syncStatus: status });
  } catch (error: any) {
    console.error('❌ [Cron] Repliers sync failed:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.post('/api/cron/email-scheduler', verifyCronSecret, async (_req: Request, res: Response) => {
  try {
    console.log('📧 [Cron] Email scheduler triggered');
    const results = await processScheduledEmails();
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    res.status(200).json({ 
      status: 'ok', 
      processed: results.length,
      succeeded: successCount,
      failed: failureCount,
    });
  } catch (error: any) {
    console.error('❌ [Cron] Email scheduler failed:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ─── Request Logging ─────────────────────────────────────────────────────────

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

// ─── App Initialization ──────────────────────────────────────────────────────
// This promise resolves when async setup is complete (routes, seed data, etc.)
// For serverless (Vercel), we await this before handling requests.

export const appReady = (async () => {
  // Initialize MLS Grid client (but don't start background schedulers — those are cron now)
  const mlsGridClient = createMLSGridClient();
  
  if (!mlsGridClient && !process.env.MLSGRID_API_TOKEN) {
    // Seed sample data for development when MLS Grid is not configured
    await seedData();
  }

  // Register Repliers sync admin routes
  registerRepliersSyncRoutes(app);
  
  const server = await registerRoutes(app);

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  // In production (non-serverless), serve static files
  // In serverless (Vercel), static files are served by the CDN, not Express
  if (app.get("env") !== "development" && !process.env.VERCEL) {
    serveStatic(app);
  }

  return { app, server };
})();

export default app;
