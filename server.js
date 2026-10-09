const express = require("express");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use(express.static(__dirname, { index: false, maxAge: "1h" }));

const apiKey = () => process.env.POLLINATIONS_API_KEY || process.env.POLLINATIONS_KEY || "";
const json = async r => { const t = await r.text(); try { return JSON.parse(t); } catch { return { detail: t.slice(0, 400) }; } };
const fail = (res, code, error) => res.status(code).json({ error });

app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/api/health", (_req, res) => res.json({
  ok: true, imageReady: !!apiKey(), chatReady: !!apiKey(),
  videoReady: !!process.env.FAL_KEY, editReady: !!apiKey()
}));

app.post("/api/image", async (req, res) => {
  try {
    if (!apiKey()) return fail(res, 503, "POLLINATIONS_API_KEY missing. Add it in hosting Environment settings.");
    const prompt = String(req.body.prompt || "").trim().slice(0, 3000);
    if (!prompt) return fail(res, 400, "Please enter an image prompt.");
    const model = String(req.body.model || "") === "zimage"
      ? "tongyi-mai/z-image-turbo" : "black-forest-labs/flux.1-schnell";
    const width = Math.max(512, Math.min(1536, Number(req.body.width) || 1024));
    const height = Math.max(512, Math.min(1536, Number(req.body.height) || 1024));
    const url = new URL("https://gen.pollinations.ai/image/" + encodeURIComponent(prompt));
    url.searchParams.set("model", model);
    url.searchParams.set("width", width);
    url.searchParams.set("height", height);
    url.searchParams.set("nologo", "true");
    const r = await fetch(url, { headers: { Authorization: "Bearer " + apiKey() }, signal: AbortSignal.timeout(120000) });
    if (!r.ok) {
      console.error("Image provider:", r.status, (await r.text()).slice(0, 400));
      return fail(res, 502, "Image provider error. Check Pollinations API key, balance, and model access.");
    }
    const type = r.headers.get("content-type") || "image/jpeg";
    if (!type.startsWith("image/")) return fail(res, 502, "Image provider returned an unexpected response.");
    res.set("Content-Type", type);
    res.set("Cache-Control", "no-store");
    res.send(Buffer.from(await r.arrayBuffer()));
  } catch (e) { console.error(e); fail(res, 500, "Image generation failed: " + e.message); }
});

app.post("/api/chat", async (req, res) => {
  try {
    if (!apiKey()) return fail(res, 503, "POLLINATIONS_API_KEY missing. Add it in hosting Environment settings.");
    const messages = (Array.isArray(req.body.messages) ? req.body.messages : [])
      .filter(m => m && ["system", "user", "assistant"].includes(m.role) && typeof m.content === "string")
      .slice(-30).map(m => ({ role: m.role, content: m.content.slice(0, 12000) }));
    if (!messages.some(m => m.role === "user")) return fail(res, 400, "Please send a message first.");
    if (!messages.some(m => m.role === "system"))
      messages.unshift({ role: "system", content: "You are Nova AI, a helpful, capable assistant. Be clear, honest, and practical." });
    const r = await fetch("https://gen.pollinations.ai/v1/chat/completions", {
      method: "POST", headers: { Authorization: "Bearer " + apiKey(), "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.CHAT_MODEL || "openai/gpt-5.4-nano", messages, temperature: 0.7 }),
      signal: AbortSignal.timeout(90000)
    });
    const d = await json(r);
    if (!r.ok) { console.error("Chat provider:", r.status, d); return fail(res, 502, d.error?.message || "Chat provider error. Check API key, balance, and model access."); }
    const reply = d.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) return fail(res, 502, "AI provider returned an empty reply.");
    res.json({ reply });
  } catch (e) { console.error(e); fail(res, 500, "Chat failed: " + e.message); }
});

app.post("/api/video", async (req, res) => {
  try {
    const prompt = String(req.body.prompt || "").trim().slice(0, 3000);
    if (!prompt) return fail(res, 400, "Please enter a video prompt.");
    if (!process.env.FAL_KEY) return fail(res, 503, "FAL_KEY missing. Add it in hosting Environment settings.");
    const duration = Math.max(2, Math.min(10, Number(req.body.duration) || 5));
    const aspect_ratio = ["portrait", "9:16"].includes(String(req.body.ratio).toLowerCase()) ? "9:16" : "16:9";
    const model = process.env.VIDEO_MODEL || "fal-ai/wan/v2.2-a14b/text-to-video";
    const r = await fetch("https://queue.fal.run/" + model, {
      method: "POST", headers: { Authorization: "Key " + process.env.FAL_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, num_frames: Math.max(17, Math.min(161, Math.round(duration * 16))), aspect_ratio, resolution: "720p" }),
      signal: AbortSignal.timeout(60000)
    });
    const d = await json(r);
    if (!r.ok) { console.error("Video provider:", r.status, d); return fail(res, 502, d.detail?.[0]?.msg || d.detail || d.message || "Video provider error. Check FAL_KEY and hosting logs."); }
    if (!d.request_id || !d.status_url || !d.response_url) return fail(res, 502, "Video provider returned incomplete queue information.");
    res.json({ request_id: d.request_id, status_url: d.status_url, response_url: d.response_url, model });
  } catch (e) { console.error(e); fail(res, 500, "Could not start video: " + e.message); }
});

function falUrl(value) {
  try { const u = new URL(value); return u.protocol === "https:" && (u.hostname === "queue.fal.run" || u.hostname.endsWith(".fal.run") || u.hostname === "fal.run"); }
  catch { return false; }
}
async function falProxy(req, res) {
  try {
    const target = String(req.query.url || "");
    if (!falUrl(target)) return fail(res, 400, "Invalid fal queue URL.");
    if (!process.env.FAL_KEY) return fail(res, 503, "FAL_KEY missing.");
    const r = await fetch(target, { headers: { Authorization: "Key " + process.env.FAL_KEY }, signal: AbortSignal.timeout(60000) });
    const d = await json(r);
    if (!r.ok) return fail(res, 502, d.detail || d.message || "Could not read video job.");
    res.json(d);
  } catch (e) { fail(res, 500, "Video job request failed: " + e.message); }
}
app.get("/api/video/status", falProxy);
app.get("/api/video/result", falProxy);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: "Invalid request." });
});
app.listen(PORT, "0.0.0.0", () => console.log("Nova AI Studio running on port " + PORT));
