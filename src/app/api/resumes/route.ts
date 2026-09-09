import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { supabaseServer, RESUME_BUCKET } from "@/lib/supabase/server";
import { extractResumeText } from "@/lib/parsing/extractText";
import { extractResumeProfile } from "@/lib/llm/prompts";

export const runtime = "nodejs";

export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("resumes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ resumes: data });
}

export async function POST(req: NextRequest) {
  const supabase = supabaseServer();

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const label = (form.get("label") as string | null) || file?.name || "Untitled resume";

  if (!file) {
    return NextResponse.json({ error: "No file provided. Attach a field named 'file'." }, { status: 400 });
  }

  const { count } = await supabase.from("resumes").select("*", { count: "exact", head: true });
  if ((count ?? 0) >= 9) {
    return NextResponse.json(
      { error: "You already have 9 resumes stored. Delete one before uploading another." },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext !== "pdf" && ext !== "docx") {
    return NextResponse.json({ error: "Only PDF and DOCX files are supported." }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const storagePath = `${uuidv4()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(RESUME_BUCKET)
    .upload(storagePath, buffer, {
      contentType: ext === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });
  if (uploadError) {
    return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });
  }

  // Insert a placeholder row immediately so the file is safely stored
  // even if text extraction or the LLM call below fails.
  const { data: inserted, error: insertError } = await supabase
    .from("resumes")
    .insert({
      label,
      original_filename: file.name,
      file_type: ext,
      storage_path: storagePath,
      profile_status: "pending"
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json({ error: `Database insert failed: ${insertError?.message}` }, { status: 500 });
  }

  try {
    const text = await extractResumeText(buffer, ext as "pdf" | "docx");
    if (text.length < 50) {
      throw new Error("Extracted almost no text — the file may be a scanned image without selectable text.");
    }
    const profile = await extractResumeProfile(text);

    const { data: updated, error: updateError } = await supabase
      .from("resumes")
      .update({ raw_text: text, profile, profile_status: "ready", profile_error: null })
      .eq("id", inserted.id)
      .select("*")
      .single();

    if (updateError) throw new Error(updateError.message);
    return NextResponse.json({ resume: updated }, { status: 201 });
  } catch (err) {
    await supabase
      .from("resumes")
      .update({ profile_status: "failed", profile_error: (err as Error).message })
      .eq("id", inserted.id);

    return NextResponse.json(
      {
        resume: { ...inserted, profile_status: "failed", profile_error: (err as Error).message },
        warning: `File was saved, but analysis failed: ${(err as Error).message}`
      },
      { status: 207 }
    );
  }
}
