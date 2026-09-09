# Personal AI Job Application Assistant — V1

**Stack:** Next.js + Vercel, Supabase Postgres/Storage/Auth, OpenAI-compatible LLM API.

## Workflow

Upload resumes once → structured profile → paste job URL → extract JD → hard-gate checks → hybrid resume ranking → show evidence/gaps/deal-breakers → confirm → save to tracker.

### Match model

Hard requirements are checked first. Then the score is:
- Required skills 35%
- Relevant experience 25%
- Responsibilities 15%
- Seniority/title 10%
- Industry/domain 5%
- Preferred skills 5%
- Job-family/profile fit 5%

The system is instructed not to invent experience and not to hide important qualification gaps.

## Deploy

1. Create a Supabase project and an Auth user.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env.local` and set all values.
4. Run `npm install` and `npm run dev`.
5. Push this folder to GitHub.
6. Import the repository into Vercel and add the same server environment variables.

**Security:** `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` are server-only. Do not prefix either with `NEXT_PUBLIC_`.

## V1 limitations intentionally kept small

- No autonomous application submission.
- Job page extraction uses direct HTTP + HTML parsing; dynamic/blocked sites can fail gracefully.
- Add manual JD paste as the next fallback for difficult sites.
- The current sample uses a single-user Supabase admin lookup for fast MVP setup; before multi-user deployment, move to cookie-authenticated server clients and RLS-backed request identity.

## Seed profile source

`PROFILE_SEED.json` contains the nine resume-positioning profiles discussed for this project. Upload the actual files through the UI for production matching.
