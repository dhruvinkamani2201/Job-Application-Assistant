import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("applications")
    .select("*, jobs(*), recommended:resumes!recommended_resume_id(label), chosen:resumes!chosen_resume_id(label)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ applications: data });
}

// The "confirm and save" step: called after the user reviews the
// analysis + recommendation on the job results page and clicks Save.
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const body = await req.json();
  const { job_id, chosen_resume_id, recommended_resume_id, notes, application_url } = body;

  if (!job_id) return NextResponse.json({ error: "job_id is required." }, { status: 400 });

  const { data: existing } = await supabase.from("applications").select("id").eq("job_id", job_id).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "This job is already in your tracker.", application_id: existing.id }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("applications")
    .insert({
      job_id,
      chosen_resume_id: chosen_resume_id || recommended_resume_id || null,
      recommended_resume_id: recommended_resume_id || null,
      notes: notes || null,
      application_url: application_url || null,
      status: "Saved"
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ application: data }, { status: 201 });
}
