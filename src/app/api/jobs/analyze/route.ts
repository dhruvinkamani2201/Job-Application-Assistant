import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { fetchJobPageText } from "@/lib/scraping/fetchJob";
import { extractJobPosting } from "@/lib/llm/prompts";
import { buildNormalizedKey } from "@/lib/dedupe";
import { scoreResumeAgainstJob } from "@/lib/scoring/matchEngine";
import type { JobRecord, Resume } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const body = await req.json().catch(() => ({}));
  const url: string | undefined = body.url;
  const pastedText: string | undefined = body.pastedText; // fallback when a page can't be scraped
  const forceReanalyze = Boolean(body.forceReanalyze);

  if (!url && !pastedText) {
    return NextResponse.json({ error: "Provide a job URL (or pasted job description text)." }, { status: 400 });
  }

  // Step 1: dedupe check on URL alone, before spending an LLM call.
  if (url && !forceReanalyze) {
    const preKey = buildNormalizedKey({ company: null, externalJobId: null, jobUrl: url });
    const { data: existingByUrl } = await supabase.from("jobs").select("*").eq("job_url", url).maybeSingle();
    if (existingByUrl) {
      return await respondWithExisting(supabase, existingByUrl as JobRecord, "This job URL was already analyzed.");
    }
    void preKey; // pre-extraction key currently unused beyond documenting intent
  }

  // Step 2: get page text.
  let pageText = pastedText || "";
  let usedFallback = Boolean(pastedText);
  if (url && !pastedText) {
    const fetched = await fetchJobPageText(url);
    if (!fetched.ok) {
      return NextResponse.json(
        {
          error: fetched.error,
          recoverable: true,
          hint: "You can paste the job description text manually and resubmit with { url, pastedText }."
        },
        { status: 422 }
      );
    }
    pageText = fetched.text;
  }

  // Step 3: LLM extraction.
  let extraction;
  try {
    extraction = await extractJobPosting(pageText, url || "pasted-text");
  } catch (err) {
    return NextResponse.json(
      { error: `Job extraction failed: ${(err as Error).message}`, recoverable: true },
      { status: 502 }
    );
  }

  const normalizedKey = buildNormalizedKey({
    company: extraction.company,
    externalJobId: extraction.external_job_id,
    jobUrl: url || `pasted:${Date.now()}`
  });

  // Step 4: dedupe again using the real normalized key (catches same job
  // pasted from a different URL, e.g. a shortened link vs. canonical URL).
  if (!forceReanalyze) {
    const { data: existingByKey } = await supabase.from("jobs").select("*").eq("normalized_key", normalizedKey).maybeSingle();
    if (existingByKey) {
      return await respondWithExisting(supabase, existingByKey as JobRecord, "This job was already analyzed (matched by company + job ID/URL).");
    }
  }

  const extractionStatus =
    extraction.extraction_confidence === "low" ? "partial" : "ready";

  const jobPayload = {
    job_url: url || "pasted-text",
    normalized_key: normalizedKey,
    company: extraction.company,
    job_title: extraction.job_title,
    external_job_id: extraction.external_job_id,
    location: extraction.location,
    required_skills: extraction.required_skills,
    preferred_skills: extraction.preferred_skills,
    experience_requirements: extraction.experience_requirements,
    responsibilities: extraction.responsibilities,
    education_requirements: extraction.education_requirements,
    keywords: extraction.keywords,
    work_authorization: extraction.work_authorization,
    other_requirements: extraction.other_requirements,
    seniority: extraction.seniority,
    industry: extraction.industry,
    raw_content: pageText.slice(0, 20000),
    extraction_status: extractionStatus,
    extraction_error: usedFallback ? "Analyzed from manually pasted text." : null
  };

  const { data: job, error: upsertError } = await supabase
    .from("jobs")
    .upsert(jobPayload, { onConflict: "normalized_key" })
    .select("*")
    .single();

  if (upsertError || !job) {
    return NextResponse.json({ error: `Could not save job: ${upsertError?.message}` }, { status: 500 });
  }

  const matches = await scoreAndStoreMatches(supabase, job as JobRecord);

  return NextResponse.json({ job, matches, dedupe: false });
}

async function respondWithExisting(supabase: ReturnType<typeof supabaseServer>, job: JobRecord, message: string) {
  const { data: matches } = await supabase
    .from("matches")
    .select("*, resumes(label, original_filename)")
    .eq("job_id", job.id)
    .order("overall_score", { ascending: false });
  return NextResponse.json({ job, matches: matches || [], dedupe: true, message });
}

async function scoreAndStoreMatches(supabase: ReturnType<typeof supabaseServer>, job: JobRecord) {
  const { data: resumes } = await supabase.from("resumes").select("*");
  const readyResumes = ((resumes || []) as Resume[]).filter((r) => r.profile_status === "ready");

  if (readyResumes.length === 0) return [];

  const results = readyResumes.map((resume) => ({ resume, result: scoreResumeAgainstJob(job, resume) }));
  results.sort((a, b) => b.result.overall_score - a.result.overall_score);

  const rows = results.map(({ resume, result }, idx) => ({
    job_id: job.id,
    resume_id: resume.id,
    overall_score: result.overall_score,
    classification: result.classification,
    score_breakdown: result.score_breakdown,
    strengths: result.strengths,
    missing_skills: result.missing_skills,
    dealbreakers: result.dealbreakers,
    reasoning: result.reasoning,
    is_recommended: idx === 0
  }));

  const { error } = await supabase.from("matches").upsert(rows, { onConflict: "job_id,resume_id" });
  if (error) throw new Error(error.message);

  // Re-select with the resume label/filename embedded so the UI can show
  // which resume each score belongs to without a second round trip.
  const { data: saved, error: selectError } = await supabase
    .from("matches")
    .select("*, resumes(label, original_filename)")
    .eq("job_id", job.id);
  if (selectError) throw new Error(selectError.message);

  return (saved || []).sort((a, b) => b.overall_score - a.overall_score);
}
