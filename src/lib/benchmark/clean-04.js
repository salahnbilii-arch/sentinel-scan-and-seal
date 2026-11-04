const ALLOWED = new Set(["https://app.example.com"]);
export function cors(req, res) {
  const origin = req.headers.origin ?? "";
  if (ALLOWED.has(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
}
