/**
 * Builds a stable dedupe key for a job posting.
 * Prefers the external job ID (scoped to company, since IDs can repeat
 * across companies' ATS systems). Falls back to normalized company +
 * normalized URL (stripped of query params/fragments) when no ID is
 * available, so the same posting pasted twice — even with different
 * tracking params — collapses to one row.
 */
export function buildNormalizedKey(params: {
  company: string | null;
  externalJobId: string | null;
  jobUrl: string;
}): string {
  const company = (params.company || "unknown-company").toLowerCase().trim().replace(/\s+/g, "-");

  if (params.externalJobId) {
    const id = params.externalJobId.toLowerCase().trim().replace(/\s+/g, "-");
    return `id:${company}:${id}`;
  }

  let normalizedUrl = params.jobUrl.trim();
  try {
    const u = new URL(params.jobUrl);
    normalizedUrl = `${u.hostname}${u.pathname}`.toLowerCase().replace(/\/$/, "");
  } catch {
    // leave as-is if not a valid URL (shouldn't happen post-validation)
  }
  return `url:${company}:${normalizedUrl}`;
}
