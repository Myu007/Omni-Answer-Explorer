# Omni-Answer Explorer

Multi-perspective AI answers for medical exam preparation.
Static frontend (`template.html`) + question banks (`source/`) + a tiny
serverless proxy (`api/answer.js`). Deployed on Vercel.

## Layout

- `template.html` — the app (single file: CSS + JS, `/* INJECT_* */` placeholders)
- `generate.py` — bakes `source/` questions into `index.html`
- `source/Semester N/*.xlsx` — question banks (`Bank` sheet, `Question` column)
- `api/answer.js` — Vercel serverless proxy: browser → `/api/answer` → Groq
- `index.html` — build output (git-ignored, regenerated on every build)
- `manifest.json`, `service-worker.js` — PWA shell
- `vercel.json` — build command; `.github/workflows/build.yml` — Pages CI

## Local build

```bash
pip install openpyxl
python generate.py
```

No secrets needed locally. Open `index.html` — preset questions work;
AI answers need the deployed backend (see below).

## Deploy

1. Push this folder to the Vercel-connected repo.
2. Vercel → Settings → Environment Variables → set `GROQ_API_KEY`.
3. Redeploy. The build runs `generate.py`; the key is only ever read
   by `api/answer.js` at request time — it never ships to browsers.

## AI models (all live on Groq)

| Slot | Model | Fallback | Perspective |
|---|---|---|---|
| AI 1 | `openai/gpt-oss-20b` | → gpt-oss-120b | Pathophysiology reasoning |
| AI 2 (default) | `openai/gpt-oss-120b` | → gpt-oss-20b | Memory framing |
| AI 3 | `openai/gpt-oss-20b` | → gpt-oss-120b | Misconceptions |
| AI 4 | `openai/gpt-oss-120b` | → gpt-oss-20b | MCQ exam fact |

Limits: 3 custom questions/session + 10s cooldown (client-side),
200-entry LRU answer cache in `localStorage`, 300 max tokens at temp 0.7
(enforced server-side in `api/answer.js`, which allowlists models).

Known limitation: `/api/answer` has no per-user auth — the 3-question
client cap is bypassable from devtools. Fine for current traffic; add
per-IP limiting (e.g. Upstash) if quota abuse appears.
