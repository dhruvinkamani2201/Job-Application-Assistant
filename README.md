# Job Application Assistant

A personal, cloud-hosted assistant that turns a job posting URL into a scored,
explainable resume recommendation and a permanent record in your job tracker.

Workflow: **Upload resumes once → paste a job URL → get an explained score for
every resume → confirm the recommendation → it's saved to your tracker.**

## Architecture

```
Browser  ──▶  Next.js (Vercel)               ──▶  Anthropic API (extraction)
                 │  API routes (server-only)
                 ▼
             Supabase (Postgres + Storage)
             - resumes (file + structured profile)
             - jobs (structured job posting)
             - matches (explainable score per resume × job)
             - applications (the tracker)
```

- **Frontend + API: Next.js on Vercel.** The App Router UI calls our own
  `/api/*` routes; those routes are the only thing that ever talks to
  Supabase or Anthropic, so no secret key is ever sent to the browser.
- **Database + file storage: Supabase.** Postgres holds structured data;
  the `resumes` storage bucket holds the original PDF/DOCX files.
- **LLM: Anthropic API**, used only for two things — turning a resume into
  a structured profile, and turning a job posting page into structured
  requirements. **Matching/scoring itself is plain, deterministic
  TypeScript** (`src/lib/scoring/matchEngine.ts`), not an LLM call, so
  every score is reproducible and fully explainable (see "Why this
  score" in the UI).
- Every resume is analyzed **once**, on upload. Job matching re-reads the
  stored structured profile — it never re-parses the PDF/DOCX.

## What's implemented (MVP)

- Upload up to 9 resumes (PDF/DOCX) → structured profile (skills, titles,
  seniority, years of experience, industries, education, certifications,
  achievements, keywords).
- Paste a job URL → page is fetched and cleaned → structured extraction
  (company, title, job ID, location, required/preferred skills,
  experience, responsibilities, education, keywords, work authorization,
  other requirements). Falls back to manual paste if a page can't be
  scraped (JS-rendered pages, login walls, bot blocking, etc.).
- Weighted, explainable scoring against every stored resume: required
  skills 40%, experience 25%, responsibilities 15%, seniority 10%,
  industry 5%, preferred skills 5%. Produces a 🟢/🟡/🔴 classification,
  a ranked list, strengths, missing skills, and deal-breakers — nothing
  is hidden.
- Human-in-the-loop by default: analyze → review the ranking → you pick
  (or accept the recommended) resume → confirm → saved to the tracker.
  (See "Adding full automation later" below for how to change this.)
- Job tracker with the full status pipeline (`Saved → To Apply → Applied
  → Assessment → Interview → Final Round → Offer → Rejected →
  Withdrawn`), search, status filter, and inline editing of dates/notes.
- Duplicate prevention: dedupes by external job ID when present,
  otherwise by normalized company + URL.
- Manual editing of any extracted job field, which automatically
  re-scores all resumes so the numbers never go stale.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run the contents of `supabase/schema.sql`.
   This creates all tables, RLS, and the `resumes` storage bucket.
3. From **Project Settings → API**, copy the Project URL, `anon` key,
   and `service_role` key.

### 2. Anthropic API key

Create a key at [console.anthropic.com](https://console.anthropic.com).

### 3. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-6
```

`SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` are server-only —
they're read only inside `src/app/api/**` route handlers, never
imported by any client component, and RLS on every table has no
policies for the anon key, so the database is unreachable directly from
a browser even if that key leaked.

### 4. Run locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.

### 5. Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Or connect the repo in the Vercel dashboard. Add the same environment
variables from step 3 under **Project Settings → Environment
Variables**, then deploy. The app is now reachable from any device,
independent of your own computer.

### Optional: restrict access

This is a single-user app with no login system in the MVP. If you're
deploying it publicly reachable, put it behind Vercel's built-in
password protection (Project Settings → Deployment Protection), or add
a simple middleware check against `APP_ACCESS_PASSWORD` — see
`src/middleware.ts.example` for a starting point.

## Adding full automation later

The system is intentionally split so the next steps don't require
re-architecting:

- **Auto-recommend without confirmation**: the recommendation already
  exists as `matches.is_recommended`; skip the "confirm" button and call
  `POST /api/applications` right after `POST /api/jobs/analyze` returns.
- **Cover letter generation**: add `src/lib/llm/coverLetter.ts` calling
  the same Anthropic client with the job + resume profile as context;
  surface it as a new tab on the job detail page.
- **Resume tailoring**: same pattern — a new LLM prompt taking a resume
  profile + job profile, outputting suggested bullet edits.
- **Application autofill**: intentionally out of scope for V1 per the
  brief (no autonomous browser/application-submission automation). If
  added later, keep it a separate, explicitly-triggered module rather
  than automatic, since it touches real applications.
- **Reminders**: a scheduled Vercel Cron job querying
  `applications.follow_up_date <= today` and emailing/notifying you.
- **Analytics**: a `/analytics` page aggregating `applications.status`
  and `matches.overall_score` — the data already needed for it exists.
- **Google Sheets sync**: a `/api/export/sheets` route using the Google
  Sheets API to mirror the `applications` table — optional, not the
  primary datastore, per the brief.

## Notes on the scoring engine

`scoreResumeAgainstJob()` in `src/lib/scoring/matchEngine.ts` is plain
code, not an LLM call — every number in the "why this score" breakdown
traces back to a rule you can read. This is deliberate: it makes scores
reproducible run-to-run, cheap to recompute (e.g. after you edit a job's
extracted fields), and easy to tune later (the weights are one exported
constant, `WEIGHTS`).

## Known MVP limitations

- Job pages that require JavaScript to render content won't scrape
  cleanly; the UI offers a "paste the text instead" fallback for that
  case.
- No login system — see "Optional: restrict access" above.
- Skill matching uses normalized substring matching (e.g. "React" vs
  "React.js"), not embeddings — good enough for an MVP, but occasionally
  it'll miss a true synonym (e.g. "GCP" vs "Google Cloud"). Worth
  revisiting if this becomes a pain point.
