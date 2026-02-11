import app, { appReady } from "../server/app";

// Ensure async initialization is complete before handling requests
await appReady;

export default app;
