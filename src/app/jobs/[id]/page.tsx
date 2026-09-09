"use client";

import { useEffect, useState } from "react";
import MatchResults from "@/components/MatchResults";

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const [job, setJob] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/jobs/${params.id}`);
    const data = await res.json();
    setJob(data.job);
    setMatches(data.matches);
    setForm(toFormState(data.job));
    setLoading(false);
  }

  useEffect(() => { load(); }, [params.id]);

  function toFormState(j: any) {
    if (!j) return {};
    return {
      company: j.company || "",
      job_title: j.job_title || "",
      location: j.location || "",
      external_job_id: j.external_job_id || "",
      seniority: j.seniority || "",
      industry: j.industry || "",
      experience_requirements: j.experience_requirements || "",
      education_requirements: j.education_requirements || "",
      work_authorization: j.work_authorization || "",
      required_skills: (j.required_skills || []).join(", "),
      preferred_skills: (j.preferred_skills || []).join(", ")
    };
  }

  async function handleSaveEdits() {
    setSaving(true);
    const payload = {
      ...form,
      required_skills: form.required_skills.split(",").map((s: string) => s.trim()).filter(Boolean),
      preferred_skills: form.preferred_skills.split(",").map((s: string) => s.trim()).filter(Boolean)
    };
    const res = await fetch(`/api/jobs/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    setJob(data.job);
    setMatches(data.matches);
    setSaving(false);
    setEditing(false);
  }

  if (loading) return <p className="text-slate">Loading…</p>;
  if (!job) return <p className="text-clay">Job not found.</p>;

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <h2 className="text-2xl">{job.job_title || "Untitled role"}</h2>
        <button className="btn-secondary text-sm" onClick={() => setEditing((v) => !v)}>
          {editing ? "Cancel" : "Edit extracted fields"}
        </button>
      </div>
      <a href={job.job_url} target="_blank" className="text-sm underline text-moss break-all">{job.job_url}</a>

      {editing ? (
        <div className="card mt-4 grid md:grid-cols-2 gap-4">
          {Object.entries(form).map(([key, value]) => (
            <div key={key}>
              <label className="label">{key.replace(/_/g, " ")}</label>
              <input
                className="input"
                value={value as string}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
          <div className="md:col-span-2">
            <button className="btn-primary" onClick={handleSaveEdits} disabled={saving}>
              {saving ? "Saving & rescoring…" : "Save & rescore"}
            </button>
          </div>
        </div>
      ) : (
        <MatchResults job={job} matches={matches} />
      )}
    </div>
  );
}
