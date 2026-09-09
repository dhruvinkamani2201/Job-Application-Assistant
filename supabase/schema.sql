-- Job Application Assistant — Supabase schema
-- Run this in the Supabase SQL editor (Project > SQL Editor > New query).
-- This is a single-user app: RLS is enabled but policies allow the
-- service role (used only by server-side API routes) full access.
-- No anon-key writes are permitted, so keys never need per-row user checks.

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- RESUMES
-- One row per uploaded resume. The file itself lives in Supabase Storage
-- (bucket: "resumes"); this row holds the extracted text and the
-- structured profile so we never have to re-parse the file again.
-- ---------------------------------------------------------------------
create table if not exists resumes (
  id uuid primary key default uuid_generate_v4(),
  label text not null,                     -- user-facing name, e.g. "Backend-focused v2"
  original_filename text not null,
  file_type text not null check (file_type in ('pdf', 'docx')),
  storage_path text not null,              -- path inside the "resumes" storage bucket
  raw_text text,                           -- extracted plain text, cached
  profile jsonb,                           -- structured profile (see README for shape)
  profile_status text not null default 'pending' check (profile_status in ('pending','ready','failed')),
  profile_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- JOBS
-- One row per analyzed job posting.
-- ---------------------------------------------------------------------
create table if not exists jobs (
  id uuid primary key default uuid_generate_v4(),
  job_url text not null,
  normalized_key text not null,            -- dedupe key: external job id OR company+url hash
  company text,
  job_title text,
  external_job_id text,                    -- job ID/reference number from the posting, if any
  location text,
  required_skills jsonb default '[]'::jsonb,
  preferred_skills jsonb default '[]'::jsonb,
  experience_requirements text,
  responsibilities jsonb default '[]'::jsonb,
  education_requirements text,
  keywords jsonb default '[]'::jsonb,
  work_authorization text,
  other_requirements text,
  seniority text,                          -- e.g. "Senior", "Mid", "Staff"
  industry text,
  raw_content text,                        -- cleaned page text used for extraction
  extraction_status text not null default 'pending' check (extraction_status in ('pending','ready','failed','partial')),
  extraction_error text,
  edited_by_user boolean not null default false, -- true once user manually edits extracted fields
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_key)
);

-- ---------------------------------------------------------------------
-- MATCHES
-- Score of a specific resume against a specific job. Recomputed whenever
-- a job is (re-)analyzed; kept for history/explainability.
-- ---------------------------------------------------------------------
create table if not exists matches (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references jobs(id) on delete cascade,
  resume_id uuid not null references resumes(id) on delete cascade,
  overall_score numeric not null,          -- 0-100
  classification text not null check (classification in ('strong','moderate','poor')),
  score_breakdown jsonb not null,          -- per-category scores + weights
  strengths jsonb default '[]'::jsonb,
  missing_skills jsonb default '[]'::jsonb,
  dealbreakers jsonb default '[]'::jsonb,
  reasoning text,                          -- short explanation of the recommendation
  is_recommended boolean not null default false,
  created_at timestamptz not null default now(),
  unique (job_id, resume_id)
);

-- ---------------------------------------------------------------------
-- TRACKER (applications)
-- Created only when the user confirms "save to tracker" for a job.
-- ---------------------------------------------------------------------
create table if not exists applications (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null unique references jobs(id) on delete cascade,
  recommended_resume_id uuid references resumes(id),
  chosen_resume_id uuid references resumes(id), -- user can override the recommendation
  status text not null default 'Saved' check (status in (
    'Saved','To Apply','Applied','Assessment','Interview',
    'Final Round','Offer','Rejected','Withdrawn'
  )),
  date_discovered date not null default current_date,
  date_applied date,
  recruiter_referral text,
  application_url text,
  notes text,
  follow_up_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_matches_job on matches(job_id);
create index if not exists idx_matches_resume on matches(resume_id);
create index if not exists idx_applications_status on applications(status);
create index if not exists idx_jobs_normalized_key on jobs(normalized_key);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_resumes_updated on resumes;
create trigger trg_resumes_updated before update on resumes
  for each row execute procedure set_updated_at();

drop trigger if exists trg_jobs_updated on jobs;
create trigger trg_jobs_updated before update on jobs
  for each row execute procedure set_updated_at();

drop trigger if exists trg_applications_updated on applications;
create trigger trg_applications_updated before update on applications
  for each row execute procedure set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security
-- All writes/reads go through server-side API routes using the
-- service role key, which bypasses RLS. We still enable RLS and add no
-- permissive policies for the anon key, so the tables are unreachable
-- directly from the browser even if the anon key leaks.
-- ---------------------------------------------------------------------
alter table resumes enable row level security;
alter table jobs enable row level security;
alter table matches enable row level security;
alter table applications enable row level security;

-- ---------------------------------------------------------------------
-- Storage bucket for original resume files.
-- Create this once via the Supabase dashboard (Storage > New bucket):
--   name: resumes
--   public: false
-- Or run:
--   insert into storage.buckets (id, name, public) values ('resumes','resumes', false);
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;
