import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = supabaseServer();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim();
  const status = searchParams.get("status");
  const sort = searchParams.get("sort") || "created_at";
  const direction = searchParams.get("direction") === "asc";

  let query = supabase.from("jobs").select("*, applications(*), matches(*)");

  if (search) {
    query = query.or(
      `company.ilike.%${search}%,job_title.ilike.%${search}%,location.ilike.%${search}%`
    );
  }

  const sortableColumns = new Set(["created_at", "company", "job_title", "location"]);
  const sortColumn = sortableColumns.has(sort) ? sort : "created_at";
  query = query.order(sortColumn, { ascending: direction });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let jobs = data || [];
  if (status) {
    jobs = jobs.filter((j: any) => {
      const app = Array.isArray(j.applications) ? j.applications[0] : j.applications;
      return app?.status === status;
    });
  }

  return NextResponse.json({ jobs });
}
