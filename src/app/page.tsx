"use client";

import { useState } from "react";
import MatchResults from "@/components/MatchResults";

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [showPasteFallback, setShowPasteFallback] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [result, setResult] = useState<{ job: any; matches: any[]; dedupe?: boolean; message?: string } | null>(null);

  async function analyze(forceReanalyze = false) {
    setLoading(true);
    setError(null);
    setHint(null);
    try {
      const res = await fetch("/api/jobs/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          pastedText: showPasteFallback ? pastedText.trim() : undefined,
          forceReanalyze
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong analyzing that job.");
        if (data.hint) { setHint(data.hint); setShowPasteFallback(true); }
        return;
      }
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-2xl mb-1">Analyze a job</h2>
      <p className="text-slate mb-6">Paste the job posting URL. We'll extract the requirements and score it against every resume you've uploaded.</p>

      <div className="card">
        <label className="label">Job posting URL</label>
        <div className="flex gap-2 flex-col sm:flex-row">
          <input
            className="input"
            placeholder="https://company.com/careers/12345"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button className="btn-primary whitespace-nowrap" disabled={!url.trim() || loading} onClick={() => analyze(false)}>
            {loading ? "Analyzing…" : "Analyze job"}
          </button>
        </div>

        {showPasteFallback && (
          <div className="mt-4">
            <label className="label">Paste the job description text instead (page couldn't be read automatically)</label>
            <textarea
              className="input min-h-[160px]"
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste the full job description here…"
            />
            <button
              className="btn-secondary mt-2"
              disabled={!pastedText.trim() || loading}
              onClick={() => analyze(false)}
            >
              Analyze pasted text
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 text-sm text-clay">
            <p>{error}</p>
            {hint && <p className="text-slate mt-1">{hint}</p>}
          </div>
        )}

        {result?.dedupe && (
          <div className="mt-4 text-sm bg-[#FBF3E4] border border-[#E6C878] rounded-sm p-3">
            <p>{result.message}</p>
            <button className="underline text-moss mt-1" onClick={() => analyze(true)}>
              Re-analyze anyway
            </button>
          </div>
        )}
      </div>

      {result && <MatchResults job={result.job} matches={result.matches} />}
    </div>
  );
}
