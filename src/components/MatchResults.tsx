"use client";

import { useState } from "react";
import ClassificationBadge from "./ClassificationBadge";

interface MatchWithResume {
  id: string;
  resume_id: string;
  overall_score: number;
  classification: string;
  score_breakdown: any;
  strengths: string[];
  missing_skills: string[];
  dealbreakers: string[];
  reasoning: string;
  is_recommended: boolean;
  resumes?: { label: string; original_filename: string };
}

export default function MatchResults({
  job,
  matches,
  onSaved
}: {
  job: any;
  matches: MatchWithResume[];
  onSaved?: (applicationId: string) => void;
}) {
  const top = matches[0];
  const [chosenResumeId, setChosenResumeId] = useState(top?.resume_id || "");
  const [expanded, setExpanded] = useState<string | null>(top?.id || null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: job.id,
          chosen_resume_id: chosenResumeId,
          recommended_resume_id: top?.resume_id
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save to tracker.");
      setSaved(true);
      onSaved?.(data.application.id);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (matches.length === 0) {
    return (
      <div className="card mt-6">
        <p className="text-slate">
          No resumes have finished processing yet, so nothing could be scored. Upload at least one resume on the{" "}
          <a href="/resumes" className="underline text-moss">Resumes</a> page, then re-analyze this job.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="card">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl">{job.job_title || "Untitled role"}</h2>
            <p className="text-slate text-sm mt-0.5">
              {[job.company, job.location].filter(Boolean).join(" · ") || "Company / location not detected"}
            </p>
          </div>
          <ClassificationBadge classification={top.classification} />
        </div>
        {job.extraction_status === "partial" && (
          <p className="text-sm text-clay mt-3">
            ⚠ This posting was extracted with low confidence — double-check the fields below and edit anything that looks off.
          </p>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4 text-sm">
          <Field label="Job ID" value={job.external_job_id} />
          <Field label="Seniority" value={job.seniority} />
          <Field label="Industry" value={job.industry} />
          <Field label="Work authorization" value={job.work_authorization} />
          <Field label="Education" value={job.education_requirements} />
          <Field label="Experience" value={job.experience_requirements} />
        </div>
      </div>

      <div>
        <h3 className="text-sm uppercase tracking-wide text-slate mb-2">Resume ranking ({matches.length})</h3>
        <div className="space-y-3">
          {matches.map((m, idx) => (
            <div key={m.id} className={`card ${m.is_recommended ? "border-moss" : ""}`}>
              <button
                className="w-full flex items-center justify-between gap-4 text-left"
                onClick={() => setExpanded(expanded === m.id ? null : m.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-slate text-sm w-5">{idx + 1}.</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{m.resumes?.label || "Resume"}</span>
                      {m.is_recommended && <span className="pill border-moss text-moss">Recommended</span>}
                    </div>
                    <span className="text-xs text-slate">{m.resumes?.original_filename}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <ClassificationBadge classification={m.classification} />
                  <span className="text-lg font-display">{m.overall_score}</span>
                </div>
              </button>

              {expanded === m.id && (
                <div className="mt-4 pt-4 border-t border-line grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate mb-1">Why this score</p>
                    <p>{m.reasoning}</p>
                    <BreakdownTable breakdown={m.score_breakdown} />
                  </div>
                  <div className="space-y-3">
                    {m.strengths.length > 0 && (
                      <div>
                        <p className="text-slate mb-1">Matching strengths</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          {m.strengths.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                    {m.missing_skills.length > 0 && (
                      <div>
                        <p className="text-slate mb-1">Missing skills</p>
                        <div className="flex flex-wrap gap-1">
                          {m.missing_skills.map((s, i) => <span key={i} className="pill">{s}</span>)}
                        </div>
                      </div>
                    )}
                    {m.dealbreakers.length > 0 && (
                      <div>
                        <p className="text-clay mb-1">Potential deal-breakers</p>
                        <ul className="list-disc list-inside space-y-0.5 text-clay">
                          {m.dealbreakers.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <p className="label">Resume to use for this application</p>
        <select className="input max-w-sm" value={chosenResumeId} onChange={(e) => setChosenResumeId(e.target.value)}>
          {matches.map((m) => (
            <option key={m.resume_id} value={m.resume_id}>
              {m.resumes?.label} {m.is_recommended ? "(recommended)" : ""} — score {m.overall_score}
            </option>
          ))}
        </select>
        <div className="mt-4 flex items-center gap-3">
          <button className="btn-primary" onClick={handleSave} disabled={saving || saved}>
            {saved ? "Saved to tracker ✓" : saving ? "Saving…" : "Confirm & save to tracker"}
          </button>
          {saved && <a href="/tracker" className="text-sm underline text-moss">View in tracker</a>}
        </div>
        {saveError && <p className="text-sm text-clay mt-2">{saveError}</p>}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-slate text-xs">{label}</p>
      <p>{value || "—"}</p>
    </div>
  );
}

function BreakdownTable({ breakdown }: { breakdown: any }) {
  const rows = [
    ["Required skills", breakdown.required_skills, "40%"],
    ["Experience", breakdown.experience, "25%"],
    ["Responsibilities", breakdown.responsibilities, "15%"],
    ["Seniority", breakdown.seniority, "10%"],
    ["Industry", breakdown.industry, "5%"],
    ["Preferred skills", breakdown.preferred_skills, "5%"]
  ] as const;

  return (
    <table className="w-full text-xs mt-3">
      <tbody>
        {rows.map(([label, val, weight]) => (
          <tr key={label} className="border-t border-line">
            <td className="py-1 text-slate">{label} ({weight})</td>
            <td className="py-1 text-right font-medium">{Math.round(val.score)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
