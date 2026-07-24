/* Vercel serverless proxy for the Gemini API.
   The key lives ONLY here, in a Vercel environment variable
   (GEMINI_API_KEY) - it is never shipped to the browser, so it
   can't be scraped from the client or committed to the repo.

   The browser POSTs a generateContent body to /api/gemini?model=...
   and we forward it to Gemini with the key attached server-side. */

const ALLOWED_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-flash-lite-latest",
  "gemini-flash-latest"
];

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    res.status(500).json({ error: "GEMINI_API_KEY is not set on the server" });
    return;
  }

  // whitelist the model so the proxy can't be pointed at arbitrary endpoints
  let model = (req.query && req.query.model) || "gemini-3.5-flash-lite";
  if (ALLOWED_MODELS.indexOf(model) === -1) model = "gemini-3.5-flash-lite";

  const url = "https://generativelanguage.googleapis.com/v1beta/models/" +
    model + ":generateContent?key=" + encodeURIComponent(key);

  try {
    // Vercel parses a JSON body into an object; forward it verbatim
    const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json");
    res.send(text);
  } catch (e) {
    res.status(502).json({ error: "proxy request failed" });
  }
};
