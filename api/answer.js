// Vercel Serverless Function — Groq proxy for Omni-Answer Explorer.
// Keeps GROQ_API_KEY server-side so it never ships to browsers.
// Route: POST /api/answer   Body: { model, systemPrompt, question }

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

const ALLOWED_MODELS = new Set([
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
]);

const MAX_TOKENS = 300;
const TEMPERATURE = 0.7;
const MAX_QUESTION_CHARS = 2000;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "server_misconfigured" });
  }

  const body = req.body || {};
  const { model, systemPrompt, question } = body;

  if (!ALLOWED_MODELS.has(model)) {
    return res.status(400).json({ error: "bad_model" });
  }
  if (typeof question !== "string" || question.trim().length < 10 || question.length > MAX_QUESTION_CHARS) {
    return res.status(400).json({ error: "bad_question" });
  }
  if (typeof systemPrompt !== "string" || systemPrompt.length === 0 || systemPrompt.length > MAX_QUESTION_CHARS) {
    return res.status(400).json({ error: "bad_prompt" });
  }

  try {
    const groqRes = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question.trim() },
        ],
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (groqRes.status === 429) {
      return res.status(429).json({ error: "rate_limited" });
    }
    if (!groqRes.ok) {
      return res.status(502).json({ error: "upstream_error" });
    }
    const data = await groqRes.json();
    const raw =
      (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
    const text = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    if (!text) {
      return res.status(502).json({ error: "empty" });
    }
    return res.status(200).json({ text });
  } catch (err) {
    if (err && err.name === "TimeoutError") {
      return res.status(504).json({ error: "timeout" });
    }
    return res.status(502).json({ error: "upstream_error" });
  }
};
