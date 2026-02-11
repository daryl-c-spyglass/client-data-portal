import { appReady } from "./app";
import { setupVite, log } from "./vite";
import { createMLSGridClient } from "./mlsgrid-client";
import { startMLSGridScheduledSync } from "./mlsgrid-sync";
import { startEmailScheduler } from "./email-scheduler";
import { startRepliersScheduledSync, triggerRepliersSync } from "./repliers-sync";

(async () => {
  const { app, server } = await appReady;

  // ─── Background Schedulers (only for long-running server, NOT serverless) ──
  const mlsGridClient = createMLSGridClient();
  
  if (mlsGridClient && process.env.DATABASE_URL) {
    console.log('🚀 MLS Grid API configured - enabling scheduled sync');
    startMLSGridScheduledSync(mlsGridClient);
  }
  
  if (process.env.DATABASE_URL) {
    console.log('📧 Starting email scheduler for seller updates...');
    startEmailScheduler();
  }
  
  console.log('🏠 Starting Repliers inventory scheduled sync...');
  startRepliersScheduledSync();

  // Trigger initial Repliers inventory sync
  triggerRepliersSync().catch(err => {
    console.error('⚠️ Initial Repliers inventory sync failed:', err.message);
  });

  // Setup Vite dev server in development mode
  if (app.get("env") === "development") {
    await setupVite(app, server);
  }

  // Start listening
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
