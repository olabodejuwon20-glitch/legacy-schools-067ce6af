import { supabase } from "@/integrations/supabase/client";

export type TradSessionStatus = "planning" | "published" | "locked";
export type TradTimetableStatus = "draft" | "pending" | "approved";
export type TradExamType = "mcq" | "theory" | "mixed";
export type TradDraftStatus = "draft" | "submitted" | "approved" | "locked";
export type TradQuestionType = "mcq" | "theory";

export interface TradSession {
  id: string;
  school_id: string;
  name: string;
  term: string | null;
  academic_year: string | null;
  start_date: string | null;
  end_date: string | null;
  status: TradSessionStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TradTimetableRow {
  id: string;
  school_id: string;
  session_id: string;
  class_id: string;
  subject_id: string | null;
  subject_name: string | null;
  exam_date: string;
  start_time: string;
  duration_minutes: number;
  venue: string | null;
  status: TradTimetableStatus;
  invigilator_name?: string | null;
  coordinator_name?: string | null;
  notes?: string | null;
}

export interface TradExam {
  id: string;
  school_id: string;
  timetable_id: string | null;
  title: string;
  instructions: string | null;
  total_marks: number;
  exam_type: TradExamType;
  draft_status: TradDraftStatus;
  author_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TradSection {
  id: string;
  school_id: string;
  exam_id: string;
  label: string;
  instructions: string | null;
  position: number;
}

export interface TradQuestion {
  id: string;
  school_id: string;
  exam_id: string;
  section_id: string | null;
  position: number;
  type: TradQuestionType;
  prompt: string;
  options: string[] | null;
  correct_index: number | null;
  model_answer: string | null;
  marks: number;
  image_path: string | null;
  explanation: string | null;
  ai_generated: boolean;
}

export interface TradUpload {
  id: string;
  school_id: string;
  exam_id: string;
  file_path: string;
  file_name: string | null;
  mime: string | null;
  status: "pending" | "parsing" | "parsed" | "failed";
  parse_meta: Record<string, unknown>;
  error: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export const TRAD_BUCKET = "trad-exam-assets";

export async function signedUrlForAsset(path: string, expires = 600): Promise<string | null> {
  const { data } = await supabase.storage.from(TRAD_BUCKET).createSignedUrl(path, expires);
  return data?.signedUrl ?? null;
}

export function formatStatus(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const DRAFT_STATUS_TONE: Record<TradDraftStatus, string> = {
  draft: "bg-muted text-foreground",
  submitted: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  locked: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
};

export interface TradAttempt {
  id: string;
  school_id: string;
  exam_id: string;
  student_id: string;
  started_at: string;
  submitted_at: string | null;
  status: "in_progress" | "submitted" | "graded" | "validated";
  mcq_score: number;
  theory_score: number;
  total_score: number;
  max_score: number;
  percentage: number;
}

export interface TradResult {
  id: string;
  school_id: string;
  exam_id: string;
  student_id: string;
  attempt_id: string;
  mcq_score: number;
  theory_score: number;
  total_score: number;
  max_score: number;
  percentage: number;
  grade: string | null;
  status: "pending_validation" | "validated" | "rejected";
  released_at: string | null;
  validated_at: string | null;
}

export interface StudentPaperRow {
  exam_id: string;
  title: string;
  instructions: string | null;
  exam_type: string;
  total_marks: number;
  exam_date: string;
  start_time: string;
  duration_minutes: number;
  venue: string | null;
  status: "upcoming" | "open" | "closed";
  attempt_id: string | null;
  attempt_status: string | null;
  result_released: boolean;
}