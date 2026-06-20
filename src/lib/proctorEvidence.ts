import { supabase } from "@/integrations/supabase/client";

/** Risk score weights — kept client-side as fallback; super-admin may override via academic_policy_defaults.risk_scoring */
export const DEFAULT_RISK_RULES: Record<string, number> = {
  tab_switch: 10, fullscreen_exit: 10, copy_attempt: 5, paste_attempt: 5,
  context_menu: 3, devtools: 20, no_face_detected: 15,
  multiple_faces_detected: 30, camera_off: 30,
};

export function riskLevel(score: number): "normal" | "review" | "high" | "critical" {
  if (score <= 20) return "normal";
  if (score <= 50) return "review";
  if (score <= 80) return "high";
  return "critical";
}

/** Capture a JPEG snapshot from a <video> element and upload to proctor-evidence. */
export async function captureAndUploadSnapshot(
  video: HTMLVideoElement,
  schoolId: string,
  attemptId: string,
): Promise<string | null> {
  try {
    if (!video || video.readyState < 2) return null;
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(video.videoWidth || 320, 480);
    canvas.height = Math.min(video.videoHeight || 240, 360);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.75));
    if (!blob) return null;
    const path = `${schoolId}/${attemptId}/${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("proctor-evidence").upload(path, blob, {
      contentType: "image/jpeg", upsert: false,
    });
    if (error) return null;
    return path;
  } catch { return null; }
}

/** Signed read URL for staff viewing evidence */
export async function getEvidenceUrl(path: string, ttl = 3600): Promise<string | null> {
  const { data } = await supabase.storage.from("proctor-evidence").createSignedUrl(path, ttl);
  return data?.signedUrl ?? null;
}