import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { scoreResumeAgainstJob } from "@/lib/scoring/matchEngine";
import type { JobRecord, Resume } from "@/lib/types";

export const runtime = "nodejs";

const EDITABLE_FIELDS = [
  "company", "job_title", "external_job_id", "location",
  "required_skills", "preferred_skills", "experience_requirements",
  "responsibilities", "education_requirements", "keywords",
  "work_authorization", "other_requirements", "seniority", "industry"
];

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const { data: job, error } = await supabase.from("jobs").select("*").eq("id", params.id).single();
  if (error || !job) return NextResponse.json({ error: error?.message || "Job not found." }, { status: 404 });

  const { data: matches } = await supabase
    .from("matches")
    .select("*, resumes(label, original_filename)")
    .eq("job_id", params.id)
    .order("overall_score", { ascending: false });

  const { data: application } = await supabase.from("applications").select("*").eq("job_id", params.id).maybeSingle();

  return NextResponse.json({ job, matches: matches || [], application: application || null });
}

// Manual editing of extracted job fields. Automatically rescoes all
// resumes against the corrected job data so scores stay trustworthy.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const body = await req.json();

  const update: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) update[field] = body[field];
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing editable in request body." }, { status: 400 });
  }
  update.edited_by_user = true;

  const { data: job, error } = await supabase.from("jobs").update(update).eq("id", params.id).select("*").single();
  if (error || !job) return NextResponse.json({ error: error?.message }, { status: 500 });

  const { data: resumes } = await supabase.from("resumes").select("*").eq("profile_status", "ready");
  const results = ((resumes || []) as Resume[]).map((resume) => ({
    resume,
    result: scoreResumeAgainstJob(job as JobRecord, resume)
  }));
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

  await supabase.from("matches").upsert(rows, { onConflict: "job_id,resume_id" });
  const { data: matches } = await supabase
    .from("matches")
    .select("*, resumes(label, original_filename)")
    .eq("job_id", job.id);

  return NextResponse.json({ job, matches: (matches || []).sort((a, b) => b.overall_score - a.overall_score) });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const { error } = await supabase.from("jobs").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
