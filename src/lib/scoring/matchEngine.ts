import type { JobRecord, Resume, ScoreBreakdown, Classification } from "../types";

// Weights per the spec. Keep these in one place so the UI and API
// always agree on how a score was produced.
export const WEIGHTS = {
  required_skills: 0.4,
  experience: 0.25,
  responsibilities: 0.15,
  seniority: 0.1,
  industry: 0.05,
  preferred_skills: 0.05
};

const SENIORITY_ORDER = [
  "junior", "entry", "mid", "senior", "staff", "lead", "principal", "manager", "director", "executive"
];

function norm(s: string): string {
  return s.toLowerCase().trim().replace(/[.\-_/]/g, " ").replace(/\s+/g, " ");
}

function seniorityRank(label: string | null | undefined): number | null {
  if (!label) return null;
  const l = norm(label);
  const idx = SENIORITY_ORDER.findIndex((s) => l.includes(s));
  return idx === -1 ? null : idx;
}

/** Fuzzy contains-based overlap: catches "React" vs "React.js", "AWS" vs "Amazon Web Services (AWS)" partially. */
function skillOverlap(required: string[], candidateSkills: string[]) {
  const candidateNorm = candidateSkills.map(norm);
  const matched: string[] = [];
  const missing: string[] = [];

  for (const req of required) {
    const reqNorm = norm(req);
    const isMatch = candidateNorm.some(
      (c) => c === reqNorm || c.includes(reqNorm) || reqNorm.includes(c)
    );
    if (isMatch) matched.push(req);
    else missing.push(req);
  }
  return { matched, missing };
}

export interface MatchResult {
  overall_score: number;
  classification: Classification;
  score_breakdown: ScoreBreakdown;
  strengths: string[];
  missing_skills: string[];
  dealbreakers: string[];
  reasoning: string;
}

export function scoreResumeAgainstJob(job: JobRecord, resume: Resume): MatchResult {
  const profile = resume.profile;
  const dealbreakers: string[] = [];
  const strengths: string[] = [];

  // If the resume has no profile yet, we can't score it meaningfully.
  if (!profile) {
    const emptyBreakdown: ScoreBreakdown = {
      required_skills: { score: 0, weight: WEIGHTS.required_skills, matched: [], missing: job.required_skills },
      experience: { score: 0, weight: WEIGHTS.experience, detail: "Resume has not finished processing." },
      responsibilities: { score: 0, weight: WEIGHTS.responsibilities, detail: "Resume has not finished processing." },
      seniority: { score: 0, weight: WEIGHTS.seniority, detail: "Resume has not finished processing." },
      industry: { score: 0, weight: WEIGHTS.industry, detail: "Resume has not finished processing." },
      preferred_skills: { score: 0, weight: WEIGHTS.preferred_skills, matched: [], missing: job.preferred_skills }
    };
    return {
      overall_score: 0,
      classification: "poor",
      score_breakdown: emptyBreakdown,
      strengths: [],
      missing_skills: job.required_skills,
      dealbreakers: ["Resume profile is not ready yet."],
      reasoning: "This resume hasn't finished processing, so it can't be scored yet."
    };
  }

  // --- Required skills (40%) ---
  const reqOverlap = skillOverlap(job.required_skills, [...profile.skills, ...profile.keywords]);
  const requiredScore =
    job.required_skills.length === 0 ? 100 : (reqOverlap.matched.length / job.required_skills.length) * 100;
  if (job.required_skills.length > 0 && reqOverlap.missing.length / job.required_skills.length > 0.5) {
    dealbreakers.push(
      `Missing more than half of required skills: ${reqOverlap.missing.join(", ")}`
    );
  }
  if (reqOverlap.matched.length > 0) {
    strengths.push(`Covers required skills: ${reqOverlap.matched.slice(0, 6).join(", ")}`);
  }

  // --- Experience (25%) ---
  let experienceScore = 50;
  let experienceDetail = "No explicit years-of-experience requirement found in the posting.";
  const requiredYearsMatch = job.experience_requirements?.match(/(\d+)\+?\s*(?:-|to)?\s*(\d+)?\s*years?/i);
  if (requiredYearsMatch && profile.years_experience != null) {
    const minYears = parseInt(requiredYearsMatch[1], 10);
    if (profile.years_experience >= minYears) {
      experienceScore = 100;
      experienceDetail = `Candidate has ${profile.years_experience}y vs. required ${minYears}y+.`;
      strengths.push(`Meets experience requirement (${profile.years_experience}y vs ${minYears}y+ required).`);
    } else {
      const gap = minYears - profile.years_experience;
      experienceScore = Math.max(0, 100 - gap * 20);
      experienceDetail = `Candidate has ${profile.years_experience}y vs. required ${minYears}y+ (${gap}y short).`;
      if (gap >= 3) dealbreakers.push(`Experience gap: needs ${minYears}+ years, resume shows ${profile.years_experience}.`);
    }
  } else if (profile.years_experience != null) {
    experienceDetail = `No specific requirement parsed; candidate has ${profile.years_experience}y experience.`;
    experienceScore = Math.min(100, 60 + profile.years_experience * 3);
  }

  // --- Responsibilities (15%) — overlap between responsibilities text and resume achievements/keywords ---
  const respCorpus = norm([...profile.achievements, ...profile.keywords, ...profile.skills].join(" "));
  const respHits = job.responsibilities.filter((r) => {
    const words = norm(r).split(" ").filter((w) => w.length > 4);
    return words.some((w) => respCorpus.includes(w));
  });
  const responsibilitiesScore =
    job.responsibilities.length === 0 ? 70 : (respHits.length / job.responsibilities.length) * 100;
  const responsibilitiesDetail =
    job.responsibilities.length === 0
      ? "No distinct responsibilities were extracted from the posting."
      : `${respHits.length}/${job.responsibilities.length} responsibilities align with resume achievements/keywords.`;

  // --- Seniority / title alignment (10%) ---
  const jobRank = seniorityRank(job.seniority);
  const candidateRanks = profile.job_titles.map((t) => seniorityRank(t.seniority)).filter((r): r is number => r != null);
  const bestCandidateRank = candidateRanks.length ? Math.max(...candidateRanks) : null;
  let seniorityScore = 60;
  let seniorityDetail = "Could not confidently compare seniority levels.";
  if (jobRank != null && bestCandidateRank != null) {
    const diff = bestCandidateRank - jobRank;
    if (diff === 0) { seniorityScore = 100; seniorityDetail = "Seniority level matches the role."; strengths.push("Seniority level matches the role."); }
    else if (diff === 1) { seniorityScore = 85; seniorityDetail = "Candidate is one level above the role (overqualified risk, minor)."; }
    else if (diff === -1) { seniorityScore = 70; seniorityDetail = "Candidate is one level below the role."; }
    else if (diff > 1) { seniorityScore = 60; seniorityDetail = "Candidate is notably more senior than the role."; }
    else { seniorityScore = 35; seniorityDetail = "Candidate appears under-leveled for this role."; dealbreakers.push("Candidate's seniority appears well below the role's level."); }
  }

  // --- Industry / domain (5%) ---
  const industryMatch = job.industry
    ? profile.industries.some((i) => norm(i).includes(norm(job.industry!)) || norm(job.industry!).includes(norm(i)))
    : null;
  const industryScore = job.industry == null ? 70 : industryMatch ? 100 : 40;
  const industryDetail = job.industry == null
    ? "No specific industry stated in the posting."
    : industryMatch
      ? `Resume shows relevant experience in ${job.industry}.`
      : `No direct experience found in ${job.industry}; resume industries: ${profile.industries.join(", ") || "none listed"}.`;
  if (industryMatch) strengths.push(`Relevant industry background (${job.industry}).`);

  // --- Preferred / nice-to-have skills (5%) ---
  const prefOverlap = skillOverlap(job.preferred_skills, [...profile.skills, ...profile.keywords]);
  const preferredScore =
    job.preferred_skills.length === 0 ? 100 : (prefOverlap.matched.length / job.preferred_skills.length) * 100;
  if (prefOverlap.matched.length > 0) strengths.push(`Bonus: has preferred skills ${prefOverlap.matched.slice(0, 4).join(", ")}.`);

  const score_breakdown: ScoreBreakdown = {
    required_skills: { score: requiredScore, weight: WEIGHTS.required_skills, matched: reqOverlap.matched, missing: reqOverlap.missing },
    experience: { score: experienceScore, weight: WEIGHTS.experience, detail: experienceDetail },
    responsibilities: { score: responsibilitiesScore, weight: WEIGHTS.responsibilities, detail: responsibilitiesDetail },
    seniority: { score: seniorityScore, weight: WEIGHTS.seniority, detail: seniorityDetail },
    industry: { score: industryScore, weight: WEIGHTS.industry, detail: industryDetail },
    preferred_skills: { score: preferredScore, weight: WEIGHTS.preferred_skills, matched: prefOverlap.matched, missing: prefOverlap.missing }
  };

  const overall_score = Math.round(
    requiredScore * WEIGHTS.required_skills +
    experienceScore * WEIGHTS.experience +
    responsibilitiesScore * WEIGHTS.responsibilities +
    seniorityScore * WEIGHTS.seniority +
    industryScore * WEIGHTS.industry +
    preferredScore * WEIGHTS.preferred_skills
  );

  let classification: Classification = "poor";
  if (overall_score >= 75 && dealbreakers.length === 0) classification = "strong";
  else if (overall_score >= 55) classification = "moderate";
  else classification = "poor";
  if (dealbreakers.length > 0 && classification === "strong") classification = "moderate";

  const reasoning =
    `Overall score ${overall_score}/100. ` +
    `Required skills matched ${reqOverlap.matched.length}/${job.required_skills.length || 0}. ` +
    `${experienceDetail} ${seniorityDetail}` +
    (dealbreakers.length ? ` Flagged concerns: ${dealbreakers.join("; ")}.` : "");

  return {
    overall_score,
    classification,
    score_breakdown,
    strengths,
    missing_skills: reqOverlap.missing,
    dealbreakers,
    reasoning
  };
}

export function classificationEmoji(c: Classification): string {
  return c === "strong" ? "🟢" : c === "moderate" ? "🟡" : "🔴";
}
