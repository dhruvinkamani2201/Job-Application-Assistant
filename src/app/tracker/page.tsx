"use client";

import { useEffect, useState } from "react";
import { APPLICATION_STATUSES } from "@/lib/types";

interface Row {
  id: string; // application id
  status: string;
  date_discovered: string;
  date_applied: string | null;
  recruiter_referral: string | null;
  application_url: string | null;
  notes: string | null;
  follow_up_date: string | null;
  jobs: {
    id: string;
    company: string | null;
    job_title: string | null;
    location: string | null;
    job_url: string;
    external_job_id: string | null;
  };
  recommended?: { label: string } | null;
  chosen?: { label: string } | null;
}

export default function TrackerPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/applications");
    const data = await res.json();
    setRows(data.applications || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function updateField(id: string, field: string, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    await fetch(`/api/applications/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value })
    });
  }

  async function removeRow(id: string) {
    if (!confirm("Remove this job from your tracker? The analyzed job data is kept, only the tracker entry is removed.")) return;
    await fetch(`/api/applications/${id}`, { method: "DELETE" });
    await load();
  }

  const filtered = rows.filter((r) => {
    const matchesSearch = !search || [r.jobs.company, r.jobs.job_title, r.jobs.location]
      .filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <h2 className="text-2xl mb-1">Tracker</h2>
      <p className="text-slate mb-6">Every job you've confirmed and saved, in one place.</p>

      <div className="flex gap-3 flex-wrap mb-4">
        <input
          className="input max-w-xs"
          placeholder="Search company, title, location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input max-w-[180px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-slate">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-slate">Nothing here yet. Analyze a job and confirm it to see it in your tracker.</p>
      ) : (
        <div className="overflow-x-auto card !p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-slate">
                <th className="p-3">Company / Role</th>
                <th className="p-3">Status</th>
                <th className="p-3">Resume</th>
                <th className="p-3">Discovered</th>
                <th className="p-3">Applied</th>
                <th className="p-3">Follow-up</th>
                <th className="p-3">Notes</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-line align-top">
                  <td className="p-3 min-w-[180px]">
                    <a href={`/jobs/${r.jobs.id}`} className="font-medium underline decoration-line hover:decoration-moss">
                      {r.jobs.job_title || "Untitled role"}
                    </a>
                    <p className="text-xs text-slate">{[r.jobs.company, r.jobs.location].filter(Boolean).join(" · ")}</p>
                  </td>
                  <td className="p-3">
                    <select
                      className="input py-1 text-sm"
                      value={r.status}
                      onChange={(e) => updateField(r.id, "status", e.target.value)}
                    >
                      {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="p-3 text-xs">{r.chosen?.label || r.recommended?.label || "—"}</td>
                  <td className="p-3 text-xs whitespace-nowrap">{r.date_discovered}</td>
                  <td className="p-3">
                    <input type="date" className="input py-1 text-xs" value={r.date_applied || ""}
                      onChange={(e) => updateField(r.id, "date_applied", e.target.value)} />
                  </td>
                  <td className="p-3">
                    <input type="date" className="input py-1 text-xs" value={r.follow_up_date || ""}
                      onChange={(e) => updateField(r.id, "follow_up_date", e.target.value)} />
                  </td>
                  <td className="p-3 min-w-[160px]">
                    <textarea
                      className="input py-1 text-xs min-h-[38px]"
                      defaultValue={r.notes || ""}
                      onBlur={(e) => updateField(r.id, "notes", e.target.value)}
                    />
                  </td>
                  <td className="p-3">
                    <button className="btn-danger text-xs" onClick={() => removeRow(r.id)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
