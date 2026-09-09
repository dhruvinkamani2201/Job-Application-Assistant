import { extractJSON } from "./client";
import type { ResumeProfile } from "../types";

export async function extractResumeProfile(resumeText: string): Promise<ResumeProfile> {
  return extractJSON<ResumeProfile>({
    system: `You are an expert technical recruiter. You read a resume and produce a
structured profile that will be used later for automated job matching.
Be precise and conservative: only include what the resume actually supports.
Normalize skill names (e.g. "ReactJS" -> "React", "node.js" -> "Node.js").

Return JSON with exactly this shape:
{
  "skills": string[],                // flat list of technologies, tools, languages, frameworks
  "job_titles": [{ "title": string, "seniority": string }],  // seniority: Junior/Mid/Senior/Staff/Principal/Lead/Manager/Director/Executive/Unspecified
  "years_experience": number | null, // total professional experience, best estimate
  "industries": string[],            // e.g. Fintech, Healthcare, E-commerce
  "education": string[],             // degree + institution, e.g. "B.S. Computer Science, UCLA"
  "certifications": string[],
  "achievements": string[],          // notable quantified achievements/projects, short phrases
  "keywords": string[],              // additional resume keywords useful for ATS matching
  "summary": string                  // 2-3 sentence neutral summary of this candidate profile
}`,
    user: `Resume text:\n\n${resumeText}`,
    maxTokens: 2000
  });
}

export interface JobExtraction {
  company: string | null;
  job_title: string | null;
  external_job_id: string | null;
  location: string | null;
  required_skills: string[];
  preferred_skills: string[];
  experience_requirements: string | null;
  responsibilities: string[];
  education_requirements: string | null;
  keywords: string[];
  work_authorization: string | null;
  other_requirements: string | null;
  seniority: string | null;
  industry: string | null;
  extraction_confidence: "high" | "medium" | "low";
}

export async function extractJobPosting(pageText: string, url: string): Promise<JobExtraction> {
  return extractJSON<JobExtraction>({
    system: `You are an expert technical recruiter. You are given the raw scraped text of a
job posting web page (it may contain navigation/menu/footer noise - ignore that) and must
extract structured fields for automated resume matching.

If a field genuinely is not present in the text, use null (or an empty array for list
fields). Do not invent information. Normalize skill names consistently
(e.g. "ReactJS" -> "React").

Return JSON with exactly this shape:
{
  "company": string | null,
  "job_title": string | null,
  "external_job_id": string | null,       // requisition/job ID if shown on the page
  "location": string | null,
  "required_skills": string[],
  "preferred_skills": string[],
  "experience_requirements": string | null, // e.g. "5+ years backend engineering"
  "responsibilities": string[],
  "education_requirements": string | null,
  "keywords": string[],
  "work_authorization": string | null,     // visa sponsorship / citizenship / authorization notes
  "other_requirements": string | null,     // anything notable that doesn't fit above (travel %, on-site days, clearance, etc.)
  "seniority": string | null,              // Junior/Mid/Senior/Staff/Principal/Lead/Manager/Director/Executive
  "industry": string | null,
  "extraction_confidence": "high" | "medium" | "low"  // your confidence the page was a real, complete job posting
}`,
    user: `Job posting URL: ${url}\n\nPage text:\n\n${pageText.slice(0, 15000)}`,
    maxTokens: 2000
  });
}
