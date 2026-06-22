import { toast as sonnerToast } from "sonner";

export const DEFAULT_SAFE_ERROR = "We couldn't complete that just now. Please try again.";
const SAFE_SIGN_IN_ERROR = "We couldn't sign you in with those details.";
const SAFE_SERVICE_ERROR = "This service is temporarily unavailable. Please try again later.";

const SENSITIVE_PATTERNS: { re: RegExp; msg: string }[] = [
  { re: /invalid login credentials|invalid credentials|password.*(invalid|wrong|incorrect|match)|pin.*(invalid|wrong|incorrect|match)|not .*admin.*school|not .*member.*school|does not belong.*school|isn't .*school/i, msg: SAFE_SIGN_IN_ERROR },
  { re: /jwt expired|invalid (jwt|token)|not authenticated|unauthorized|auth session missing/i, msg: "Your session has expired. Please sign in again." },
  { re: /permission denied|row-level security|violates row level|\brls\b|policy|forbidden/i, msg: "You don't have permission to do that." },
  { re: /failed to fetch|networkerror|typeerror: load failed|network request failed/i, msg: "Network issue — check your connection and try again." },
  { re: /edge function|functionshttperror|functionsfetcherror|functionsrelayerror|non-2xx|supabase|postgrest|gotrue|kong|cors|fetch failed|aborted/i, msg: SAFE_SERVICE_ERROR },
  { re: /api[_\s-]?key|secret|not configured|missing env|lovable_api_key|paystack|openai|anthropic|gateway error/i, msg: SAFE_SERVICE_ERROR },
  { re: /null value in column|not-null constraint|violates .*constraint|duplicate key|unique constraint|foreign key|invalid input syntax|check constraint|value too long|relation .* does not exist|column .* does not exist|function .* does not exist|syntax error at or near|\bpgrst\d+\b/i, msg: "We couldn't save that because some information is missing or invalid." },
  { re: /postgres_changes|realtime[:.]|channel|subscribe\(\)|websocket|wss?:\/\//i, msg: "Connection hiccup — please refresh and try again." },
  { re: /typeerror|referenceerror|syntaxerror|undefined is not|cannot read prop|at\s+\w+\s*\(|\/src\/|\/supabase\/|\.tsx?:\d+|\.jsx?:\d+/i, msg: "Something went wrong on our side. Please try again." },
];

function rawMessage(input: unknown): string {
  if (!input) return "";
  if (typeof input === "string") return input;
  if (input instanceof Error) return input.message || "";
  if (typeof input === "object") {
    const anyInput = input as any;
    return String(anyInput.message || anyInput.error_description || anyInput.error || "");
  }
  return String(input);
}

export function sanitizeErrorMessage(input: unknown, fallback = DEFAULT_SAFE_ERROR): string {
  const raw = rawMessage(input).trim();
  if (!raw) return fallback;
  for (const { re, msg } of SENSITIVE_PATTERNS) {
    if (re.test(raw)) return msg || fallback;
  }
  if (
    raw.length < 160 &&
    !/[{}<>]|::|\/\w+\/|_[a-z]+_|[a-f0-9]{8}-[a-f0-9]{4}|\bE\d{3}\b|\bPGRST\b|\b[A-Z_]{8,}\b/.test(raw)
  ) {
    return raw;
  }
  return fallback;
}

function sanitizeToastOptions(options: any) {
  if (!options || typeof options !== "object") return options;
  const next = { ...options };
  if (typeof next.description === "string") {
    next.description = /^cause:/i.test(next.description)
      ? "Please try again or contact support if it continues."
      : sanitizeErrorMessage(next.description, next.description);
  }
  return next;
}

let safeToastsInstalled = false;

export function installUserSafeToasts() {
  if (safeToastsInstalled) return;
  safeToastsInstalled = true;
  const originalError = sonnerToast.error.bind(sonnerToast);
  (sonnerToast as any).error = ((message?: any, options?: any) =>
    originalError(sanitizeErrorMessage(message), sanitizeToastOptions(options))) as typeof sonnerToast.error;
}