# KitPilot

KitPilot turns the BeaverBot Ball Shooter Kit into a classroom-ready lesson plan, three task-structure differentiation tiers, and a parent letter.

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
