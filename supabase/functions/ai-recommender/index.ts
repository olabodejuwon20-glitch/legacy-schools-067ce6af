const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function ruleBasedFallback(promptText: string) {
  const text = promptText.toLowerCase();
  let studentCount = 100;

  // Extract student numbers like "350 students", "500 pupils", "80 kids"
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
    reasons.push("Hostel & Boarding for resident students");
  }
  if (/bus|transport|transit|driver|commute/i.test(text)) {
    recommended_addons.push("mod_transport");
    reasons.push("Transport & Logistics for school bus routes");
  }
  if (/lab|science|physics|chemistry|biology|stem/i.test(text)) {
    recommended_addons.push("mod_virtual_lab");
    reasons.push("Virtual Science Lab for interactive STEM simulations");
  }
  if (/sms|text|broadcast|emergency alert/i.test(text)) {
    recommended_addons.push("mod_messaging");
    reasons.push("Advanced Comm. (SMS) for urgent guardian messaging");
  }
  if (/auto|beast|copilot auto|autonomous/i.test(text)) {
    recommended_addons.push("mod_copilot_auto");
    reasons.push("Copilot Auto for autonomous administrative operations");
  } else if (/copilot|ai note|workflow|automation/i.test(text)) {
    recommended_addons.push("mod_copilot_flow");
    reasons.push("Copilot Flow for automated workflows and smart schedules");
  }

  let reasoning = `Recommended capacity: ${recommended_bracket.replace("_", " ")} based on ~${studentCount} students.`;
  if (reasons.length > 0) {
    reasoning += ` Recommended modules: ${reasons.join(", ")}.`;
  } else {
    reasoning += " Core features (Administration, Gradebook, CBT, Library, Base AI) are included at no extra cost.";
  }

  return {
    recommended_bracket,
    recommended_addons,
    reasoning,
    suggested_student_count: studentCount,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const description = (body.description || body.prompt || "").trim();

    if (!description) {
      return json({ error: "missing_description", message: "School description is required" }, 400);
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      // Return smart rule-based fallback if Gemini key is not configured in edge runtime
      return json(ruleBasedFallback(description));
    }

    const systemPrompt = `You are an expert school technology consultant and pricing architect for LegacySKool.
Your job is to recommend the best subscription tier and add-ons based on an admin's school description.

Database pricing brackets:
- 'up_to_100': up to 100 students (₦25,000 / term)
- 'up_to_200': up to 200 students (₦45,000 / term)
- 'up_to_500': up to 500 students (₦80,000 / term)
- 'up_to_1000': up to 1,000 students (₦130,000 / term)

Available Add-on Modules:
- 'mod_virtual_lab': Virtual Science Lab (₦35,000) - For STEM, physics, chemistry, biology labs.
- 'mod_hostel': Hostel & Boarding (₦25,000) - For boarding houses, dormitories, residential schools.
- 'mod_transport': Transport & Logistics (₦20,000) - For school buses, drivers, routes, parent pickup alerts.
- 'mod_messaging': Advanced Comm. (SMS) (₦15,000) - For SMS broadcasts and direct phone notifications.
- 'mod_copilot_flow': Copilot Flow (Advanced) (₦25,000) - For AI automations, timetable scheduling, reminders.
- 'mod_copilot_auto': Copilot Auto (Beast) (₦50,000) - Full autonomy, hands-free report comments and proactive management.

You MUST respond with a JSON object in this EXACT schema:
{
  "recommended_bracket": "up_to_100" | "up_to_200" | "up_to_500" | "up_to_1000",
  "recommended_addons": string[],
  "reasoning": string,
  "suggested_student_count": number
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: systemPrompt },
                { text: `Admin Description: "${description}"` },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      console.warn("[ai-recommender] Gemini API error, falling back to heuristic");
      return json(ruleBasedFallback(description));
    }

    const data = await response.json();
    const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) {
      return json(ruleBasedFallback(description));
    }

    const parsed = JSON.parse(textOutput);
    return json({
      recommended_bracket: parsed.recommended_bracket || "up_to_100",
      recommended_addons: Array.isArray(parsed.recommended_addons) ? parsed.recommended_addons : [],
      reasoning: parsed.reasoning || "Package customized to your school requirements.",
      suggested_student_count: parsed.suggested_student_count || 100,
    });
  } catch (err: any) {
    console.error("[ai-recommender] error", err);
    return json(ruleBasedFallback(""));
  }
});
