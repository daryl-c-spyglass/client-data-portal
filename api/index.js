// Vercel serverless function entry point
const app = await import('../dist/index.js');
export default app.default || app;
