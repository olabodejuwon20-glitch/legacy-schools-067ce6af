import { supabase } from "@/integrations/supabase/client";

export interface AIPlanRecommendation {
  recommended_bracket: string;
  recommended_addons: string[];
  reasoning: string;
  suggested_student_count: number;
}

export function heuristicRecommendation(description: string): AIPlanRecommendation {
  const text = (description || "").toLowerCase();
  let studentCount = 100;

  const match = text.match(/(\d+)\s*(students|pupils|children|kids|learners)/i) || text.match(/\b(\d{2,4})\b/);
  if (match) {
    const parsed = parseInt(match[1], 10);
    if (!isNaN(parsed) && parsed > 0) studentCount = parsed;
  }

  let recommended_bracket = "up_to_100";
  if (studentCount > 500) recommended_bracket = "up_to_1000";
  else if (studentCount > 200) recommended_bracket = "up_to_500";
  else if (studentCount > 100) recommended_bracket = "up_to_200";

  const recommended_addons: string[] = [];
  const reasons: string[] = [];

  if (/board|hostel|dorm|resident/i.test(text)) {
    recommended_addons.push("mod_hostel");
    reasons.push("Hostel & Boarding for residential students");
  }
  if (/bus|transport|transit|driver|commute/i.test(text)) {
    recommended_addons.push("mod_transport");
    reasons.push("Transport & Logistics for fleet operations");
  }
  if (/lab|science|physics|chemistry|biology|stem/i.test(text)) {
    recommended_addons.push("mod_virtual_lab");
    reasons.push("Virtual Science Lab for interactive STEM simulations");
  }
  if (/sms|text|broadcast|emergency alert/i.test(text)) {
    recommended_addons.push("mod_messaging");
    reasons.push("Advanced Comm. (SMS) for instant guardian reach");
  }
  if (/auto|beast|copilot auto|autonomous/i.test(text)) {
    recommended_addons.push("mod_copilot_auto");
    reasons.push("Copilot Auto for autonomous administrative actions");
  } else if (/copilot|ai note|workflow|automation/i.test(text)) {
    recommended_addons.push("mod_copilot_flow");
    reasons.push("Copilot Flow for automated schedules and workflows");
  }

  let reasoning = `Recommended capacity: ${recommended_bracket.replace(/_/g, " ")} based on ~${studentCount} students.`;
  if (reasons.length > 0) {
    reasoning += ` Recommended modules: ${reasons.join(", ")}.`;
  } else {
    reasoning += " All core features (Administration, Gradebook, CBT, Library, Base AI) are included at no extra cost.";
  }

  return {
    recommended_bracket,
    recommended_addons,
    reasoning,
    suggested_student_count: studentCount,
  };
}

export async function recommendPlan(description: string): Promise<AIPlanRecommendation> {
  const trimmed = description.trim();
  if (!trimmed) {
    throw new Error("Please enter a description of your school setup.");
  }

  try {
    const { data, error } = await supabase.functions.invoke("ai-recommender", {
      body: { description: trimmed },
    });

    if (error || !data) {
      console.warn("[aiRecommender] Edge function invoke failed, using client heuristic fallback", error);
      return heuristicRecommendation(trimmed);
    }

    return {
      recommended_bracket: data.recommended_bracket || "up_to_100",
      recommended_addons: Array.isArray(data.recommended_addons) ? data.recommended_addons : [],
      reasoning: data.reasoning || "Package tailored to your requirements.",
      suggested_student_count: data.suggested_student_count || 100,
    };
  } catch (err) {
    console.warn("[aiRecommender] error invoking function, falling back to heuristic", err);
    return heuristicRecommendation(trimmed);
  }
}
