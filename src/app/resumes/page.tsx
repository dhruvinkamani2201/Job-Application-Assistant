"use client";

import { useEffect, useState } from "react";
import type { Resume } from "@/lib/types";

export default function ResumesPage() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/resumes");
    const data = await res.json();
    setResumes(data.resumes || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("label", file.name.replace(/\.(pdf|docx)$/i, ""));
    try {
      const res = await fetch("/api/resumes", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok && res.status !== 207) throw new Error(data.error || "Upload failed.");
      if (data.warning) setError(data.warning);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this resume? This cannot be undone.")) return;
    await fetch(`/api/resumes/${id}`, { method: "DELETE" });
    await load();
  }

  async function handleRename(id: string, label: string) {
    await fetch(`/api/resumes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label })
    });
    await load();
  }

  async function handleReprocess(id: string) {
    await fetch(`/api/resumes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reprocess: true })
    });
    await load();
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <h2 className="text-2xl">Resumes</h2>
        <span className="text-sm text-slate">{resumes.length} / 9 stored</span>
      </div>
      <p className="text-slate mb-6">Upload each resume once. We extract skills, titles, experience, and keywords so future job matches are instant.</p>

      <div className="card mb-6">
        <label className="label">Upload a resume (PDF or DOCX)</label>
        <input
          type="file"
          accept=".pdf,.docx"
          onChange={handleUpload}
          disabled={uploading || resumes.length >= 9}
          className="text-sm"
        />
        {uploading && <p className="text-sm text-slate mt-2">Uploading and analyzing… this can take up to 30 seconds.</p>}
        {resumes.length >= 9 && <p className="text-sm text-clay mt-2">You've reached the 9-resume limit. Delete one to add another.</p>}
        {error && <p className="text-sm text-clay mt-2">{error}</p>}
      </div>

      {loading ? (
        <p className="text-slate">Loading…</p>
      ) : resumes.length === 0 ? (
        <p className="text-slate">No resumes yet. Upload your first one above.</p>
      ) : (
        <div className="space-y-3">
          {resumes.map((r) => (
            <div key={r.id} className="card">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <input
                    defaultValue={r.label}
                    onBlur={(e) => e.target.value !== r.label && handleRename(r.id, e.target.value)}
                    className="font-medium bg-transparent border-b border-transparent hover:border-line focus:border-moss outline-none"
                  />
                  <p className="text-xs text-slate mt-0.5">{r.original_filename} · uploaded {new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={r.profile_status} />
                  <button className="text-sm underline text-moss" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                    {expanded === r.id ? "Hide details" : "View profile"}
                  </button>
                  {r.profile_status === "failed" && (
                    <button className="text-sm underline text-moss" onClick={() => handleReprocess(r.id)}>Retry</button>
                  )}
                  <button className="btn-danger text-sm" onClick={() => handleDelete(r.id)}>Delete</button>
                </div>
              </div>

              {r.profile_status === "failed" && (
                <p className="text-sm text-clay mt-2">{r.profile_error}</p>
              )}

              {expanded === r.id && r.profile && (
                <div className="mt-4 pt-4 border-t border-line grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate mb-1">Skills</p>
                    <div className="flex flex-wrap gap-1">{r.profile.skills.map((s, i) => <span key={i} className="pill">{s}</span>)}</div>
                    <p className="text-slate mb-1 mt-3">Job titles</p>
                    <ul className="list-disc list-inside">
                      {r.profile.job_titles.map((t, i) => <li key={i}>{t.title} — {t.seniority}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="text-slate mb-1">Summary</p>
                    <p>{r.profile.summary}</p>
                    <p className="text-slate mb-1 mt-3">Years experience</p>
                    <p>{r.profile.years_experience ?? "Unknown"}</p>
                    <p className="text-slate mb-1 mt-3">Industries</p>
                    <p>{r.profile.industries.join(", ") || "—"}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    ready: "border-moss text-moss",
    pending: "border-slate text-slate",
    failed: "border-clay text-clay"
  };
  return <span className={`pill ${map[status] || ""}`}>{status}</span>;
}
