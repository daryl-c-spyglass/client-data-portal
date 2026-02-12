export default function handler(req, res) {
  res.status(200).json({ 
    message: 'Serverless function working',
    url: req.url,
    method: req.method
  });
}
