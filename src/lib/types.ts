export interface ResumeProfile {
  skills: string[];
  job_titles: { title: string; seniority: string }[];
  years_experience: number | null;
  industries: string[];
  education: string[];
  certifications: string[];
  achievements: string[];
  keywords: string[];
  summary: string;
}

export interface Resume {
  id: string;
  label: string;
  original_filename: string;
  file_type: "pdf" | "docx";
  storage_path: string;
  raw_text: string | null;
  profile: ResumeProfile | null;
  profile_status: "pending" | "ready" | "failed";
  profile_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobRecord {
  id: string;
  job_url: string;
  normalized_key: string;
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
  raw_content: string | null;
  extraction_status: "pending" | "ready" | "failed" | "partial";
  extraction_error: string | null;
  edited_by_user: boolean;
  created_at: string;
  updated_at: string;
}

export type Classification = "strong" | "moderate" | "poor";

export interface ScoreBreakdown {
  required_skills: { score: number; weight: number; matched: string[]; missing: string[] };
  experience: { score: number; weight: number; detail: string };
  responsibilities: { score: number; weight: number; detail: string };
  seniority: { score: number; weight: number; detail: string };
  industry: { score: number; weight: number; detail: string };
  preferred_skills: { score: number; weight: number; matched: string[]; missing: string[] };
}

export interface MatchRecord {
  id: string;
  job_id: string;
  resume_id: string;
  overall_score: number;
  classification: Classification;
  score_breakdown: ScoreBreakdown;
  strengths: string[];
  missing_skills: string[];
  dealbreakers: string[];
  reasoning: string;
  is_recommended: boolean;
  created_at: string;
}

export type ApplicationStatus =
  | "Saved" | "To Apply" | "Applied" | "Assessment" | "Interview"
  | "Final Round" | "Offer" | "Rejected" | "Withdrawn";

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "Saved", "To Apply", "Applied", "Assessment", "Interview",
  "Final Round", "Offer", "Rejected", "Withdrawn"
];

export interface Application {
  id: string;
  job_id: string;
  recommended_resume_id: string | null;
  chosen_resume_id: string | null;
  status: ApplicationStatus;
  date_discovered: string;
  date_applied: string | null;
  recruiter_referral: string | null;
  application_url: string | null;
  notes: string | null;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string;
}
