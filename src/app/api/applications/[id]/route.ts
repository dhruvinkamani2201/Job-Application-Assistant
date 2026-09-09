import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { APPLICATION_STATUSES } from "@/lib/types";

export const runtime = "nodejs";

const EDITABLE_FIELDS = [
  "status", "date_applied", "recruiter_referral", "application_url",
  "notes", "follow_up_date", "chosen_resume_id"
];

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const body = await req.json();

  if (body.status && !APPLICATION_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: `Invalid status. Must be one of: ${APPLICATION_STATUSES.join(", ")}` }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) update[field] = body[field];
  }
  // Auto-fill date_applied the first time status moves to "Applied" if not already set.
  if (update.status === "Applied") {
    const { data: current } = await supabase.from("applications").select("date_applied").eq("id", params.id).single();
    if (current && !current.date_applied && !update.date_applied) {
      update.date_applied = new Date().toISOString().slice(0, 10);
    }
  }

  const { data, error } = await supabase.from("applications").update(update).eq("id", params.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ application: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const { error } = await supabase.from("applications").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
