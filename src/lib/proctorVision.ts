// Lightweight face-presence detection for CBT proctoring.
// Uses the browser-native `window.FaceDetector` (Chromium-based browsers).
// Returns null when the API isn't available so callers can degrade gracefully
// (snapshots still uploaded, just no automatic face-count check).

declare global {
  interface Window {
    FaceDetector?: new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
      detect: (source: CanvasImageSource) => Promise<Array<unknown>>;
    };
  }
}

let detector: { detect: (s: CanvasImageSource) => Promise<unknown[]> } | null = null;
let initTried = false;

export function faceDetectorAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.FaceDetector === "function";
}

function getDetector() {
  if (initTried) return detector;
  initTried = true;
  try {
    if (window.FaceDetector) {
      detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
    }
  } catch {
    detector = null;
  }
  return detector;
}

/** Returns number of faces detected, or null when detection isn't supported. */
export async function countFaces(video: HTMLVideoElement): Promise<number | null> {
  const d = getDetector();
  if (!d) return null;
  if (!video || video.readyState < 2) return null;
  try {
    const faces = await d.detect(video);
    return Array.isArray(faces) ? faces.length : 0;
  } catch {
    return null;
  }
}

/** Speak a short warning to the student using the Web Speech API. */
export function speakWarning(message: string) {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(message);
    u.rate = 1;
    u.pitch = 1;
    u.volume = 1;
    u.lang = "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore — voice warning is best-effort */
  }
}