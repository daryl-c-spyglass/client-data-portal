import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import passport from "passport";
import ConnectPgSimple from "connect-pg-simple";
import { Pool } from "@neondatabase/serverless";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedData } from "./seed-data";
import { setupAuth, setupAuthRoutes } from "./auth";
import { createMLSGridClient } from "./mlsgrid-client";
import { startMLSGridScheduledSync, triggerManualSync } from "./mlsgrid-sync";
import { startEmailScheduler } from "./email-scheduler";
import { startRepliersScheduledSync, registerRepliersSyncRoutes, triggerRepliersSync } from "./repliers-sync";

const app = express();

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
      pool: new Pool({ connectionString: process.env.DATABASE_URL }),
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
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

setupAuth();
setupAuthRoutes(app);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
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
  // Initialize MLS Grid sync or seed sample data
  const mlsGridClient = createMLSGridClient();
  
  if (mlsGridClient && process.env.DATABASE_URL) {
    // Enable scheduled sync at 12:00 AM CST daily
    console.log('🚀 MLS Grid API configured - enabling scheduled sync');
    startMLSGridScheduledSync(mlsGridClient);
  } else if (!process.env.MLSGRID_API_TOKEN) {
    // Seed sample data for development when MLS Grid is not configured
    await seedData();
  }
  
  // Start email scheduler for seller updates
  if (process.env.DATABASE_URL) {
    console.log('📧 Starting email scheduler for seller updates...');
    startEmailScheduler();
  }
  
  // Start Repliers inventory scheduled sync (daily at 12 AM CST)
  console.log('🏠 Starting Repliers inventory scheduled sync...');
  startRepliersScheduledSync();
  
  // Register Repliers sync admin routes
  registerRepliersSyncRoutes(app);
  
  const server = await registerRoutes(app);
  
  // Trigger initial Repliers inventory sync (after routes are registered so client is initialized)
  triggerRepliersSync().catch(err => {
    console.error('⚠️ Initial Repliers inventory sync failed:', err.message);
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
