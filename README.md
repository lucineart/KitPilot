# KitPilot

KitPilot turns the BeaverBot Ball Shooter Kit into a classroom-ready lesson plan, three task-structure differentiation tiers, and a parent letter.

Built for **OpenAI Build Week 2026** (Education track) by BeaverBot, a STEAM education kit brand.

## How Codex & GPT-5.6 were used

- **GPT-5.6 (Responses API)** generates every classroom document at runtime: the lesson plan, the three differentiation tiers, and the parent letter. All calls run server-side, grounded in the YAML knowledge base extracted from the kit's official curriculum (`ball-shooter-knowledge.md`), under strict content contracts (`lib/prompts.ts`) that forbid inventing build steps, materials, or slide content.
- **Codex** built this entire application from a written product spec and acceptance criteria: the Next.js app, the sequential streaming generation pipeline, the deterministic output guards, the print-ready PDF export, and the BeaverBot brand restyle. A session screenshot is in `codex_session.png`.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `OPENAI_API_KEY` in `.env.local` before generating a classroom pack. The key is read only by the server-side API route.

## Architecture

- `app/api/generate/route.ts` streams a sequential three-call GPT-5.6 pipeline as newline-delimited JSON.
- `lib/knowledge.ts` loads only the YAML block from `ball-shooter-knowledge.md` and injects it into every model call.
- `lib/prompts.ts` contains the strict lesson plan, differentiation, and parent-letter generation contracts.
- `components/KitPilotApp.tsx` renders the single-page form, per-tab progress states, copy actions, and Markdown downloads.
