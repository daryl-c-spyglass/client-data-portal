let app;

export default async function handler(req, res) {
  if (!app) {
    app = (await import('../dist/index.js')).default;
  }
  return app(req, res);
}
