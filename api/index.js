export default async function handler(req, res) {
  const app = (await import('../dist/index.js')).default;
  return app(req, res);
}
