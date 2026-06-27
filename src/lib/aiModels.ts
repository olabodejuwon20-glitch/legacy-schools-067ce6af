/**
 * Curated catalog of AI models powering the platform.
 * Grouped by tier so admins can match models to task heaviness.
 */
export type AiModelTier = "light" | "balanced" | "heavy" | "reasoning";

export interface AiModelInfo {
  id: string;
  label: string;
  vendor: "Google" | "OpenAI";
  tier: AiModelTier;
  blurb: string;
}

export const AI_MODELS: AiModelInfo[] = [
  // Google Gemini
  { id: "google/gemini-2.5-flash-lite",  label: "Gemini 2.5 Flash-Lite", vendor: "Google", tier: "light",     blurb: "Cheapest & fastest. Great for short answers, classification, bulk drafts." },
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash",        vendor: "Google", tier: "balanced",  blurb: "Default. Fast, multimodal, good quality for most tasks." },
  { id: "google/gemini-2.5-flash",       label: "Gemini 2.5 Flash",      vendor: "Google", tier: "balanced",  blurb: "Balanced speed/quality. Reliable workhorse." },
  { id: "google/gemini-2.5-pro",         label: "Gemini 2.5 Pro",        vendor: "Google", tier: "heavy",     blurb: "Strong multimodal + long-context reasoning." },
  // OpenAI GPT
  { id: "openai/gpt-5-nano",             label: "GPT-5 Nano",            vendor: "OpenAI", tier: "light",     blurb: "Fast & low-cost OpenAI option." },
  { id: "openai/gpt-5-mini",             label: "GPT-5 Mini",            vendor: "OpenAI", tier: "balanced",  blurb: "Solid all-rounder, lower cost." },
  { id: "openai/gpt-5",                  label: "GPT-5",                 vendor: "OpenAI", tier: "heavy",     blurb: "Powerful all-rounder for hard, nuanced tasks." },
  { id: "openai/gpt-5.4",                label: "GPT-5.4",               vendor: "OpenAI", tier: "reasoning", blurb: "Advanced reasoning for complex multi-step problems." },
  { id: "openai/gpt-5.5",                label: "GPT-5.5",               vendor: "OpenAI", tier: "reasoning", blurb: "Most capable. Use for the hardest reasoning & coding tasks." },
];

export const AI_MODEL_BY_ID: Record<string, AiModelInfo> = Object.fromEntries(
  AI_MODELS.map((m) => [m.id, m]),
);

/** Tasks that route through the gateway and can have a per-role default model. */
export const AI_TASKS: { kind: string; label: string; description: string; suggestedTier: AiModelTier }[] = [
  { kind: "tutor",              label: "AI Tutor chat",            description: "Student/teacher conversations with the in-app tutor.",      suggestedTier: "balanced" },
  { kind: "lesson_plan",        label: "Lesson plans",             description: "Generate full lesson plans & schemes of work.",            suggestedTier: "heavy"    },
  { kind: "generate_questions", label: "Generate exam questions",  description: "Auto-draft exam/CA/test questions for teacher review.",    suggestedTier: "reasoning"},
  { kind: "parse_questions",    label: "Parse uploaded papers",    description: "OCR + extract questions from uploaded PDF/Word files.",    suggestedTier: "heavy"    },
  { kind: "mark_essay",         label: "Essay grading",            description: "Grade essay & open-ended answers.",                        suggestedTier: "reasoning"},
  { kind: "report_comment",     label: "Report-card comments",     description: "Draft per-student termly comments.",                       suggestedTier: "balanced" },
  { kind: "comms_assist",       label: "Comms drafting",           description: "Draft announcements, parent messages, broadcasts.",         suggestedTier: "balanced" },
  { kind: "parent_alerts",      label: "Parent alert drafts",      description: "Auto-draft attendance / grade-drop / fee alerts.",         suggestedTier: "light"    },
  { kind: "parent_digest",      label: "Parent digest",            description: "Weekly parent summary emails.",                            suggestedTier: "light"    },
  { kind: "principal_request",  label: "Principal Copilot",        description: "Heavy analytics, planning & decision support for admins.", suggestedTier: "reasoning"},
];

export const AI_ROLES: { id: string; label: string }[] = [
  { id: "default", label: "Default" },
  { id: "admin",   label: "Admin"   },
  { id: "teacher", label: "Teacher" },
  { id: "student", label: "Student" },
  { id: "parent",  label: "Parent"  },
];

export const TIER_BADGE: Record<AiModelTier, string> = {
  light:     "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  balanced:  "bg-blue-500/10 text-blue-600 border-blue-500/20",
  heavy:     "bg-purple-500/10 text-purple-600 border-purple-500/20",
  reasoning: "bg-amber-500/10 text-amber-600 border-amber-500/20",
};