import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, RESUME_BUCKET } from "@/lib/supabase/server";
import { extractResumeProfile } from "@/lib/llm/prompts";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const { data, error } = await supabase.from("resumes").select("*").eq("id", params.id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ resume: data });
}

// Supports: { label } to rename, { profile } to manually edit the structured
// profile, or { reprocess: true } to re-run LLM extraction on the stored raw_text.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const body = await req.json();

  if (body.reprocess) {
    const { data: resume, error: fetchError } = await supabase
      .from("resumes")
      .select("raw_text")
      .eq("id", params.id)
      .single();
    if (fetchError || !resume?.raw_text) {
      return NextResponse.json({ error: "No stored resume text to reprocess." }, { status: 400 });
    }
    try {
      const profile = await extractResumeProfile(resume.raw_text);
      const { data, error } = await supabase
        .from("resumes")
        .update({ profile, profile_status: "ready", profile_error: null })
        .eq("id", params.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ resume: data });
    } catch (err) {
      await supabase.from("resumes").update({ profile_status: "failed", profile_error: (err as Error).message }).eq("id", params.id);
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
  }

  const update: Record<string, unknown> = {};
  if (typeof body.label === "string") update.label = body.label;
  if (body.profile) update.profile = body.profile; // manual edit of extracted profile

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await supabase.from("resumes").update(update).eq("id", params.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ resume: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = supabaseServer();

  const { data: resume } = await supabase.from("resumes").select("storage_path").eq("id", params.id).single();
  if (resume?.storage_path) {
    await supabase.storage.from(RESUME_BUCKET).remove([resume.storage_path]);
  }
  const { error } = await supabase.from("resumes").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
