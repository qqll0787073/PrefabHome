export type SafeLogLevel = "info" | "warn" | "error";

export interface SafeLogRecord {
  level: SafeLogLevel;
  message: string;
  context?: unknown;
  timestamp: string;
}

export interface SafeLogSink {
  write: (record: SafeLogRecord) => void;
}

export interface SafeLogger {
  info: (message: string, context?: unknown) => void;
  warn: (message: string, context?: unknown) => void;
  error: (message: string, context?: unknown) => void;
}

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY = /(?:authorization|cookie|access[_-]?token|refresh[_-]?token|password|passwd|secret|service[_-]?role|api[_-]?key|anon[_-]?key|publishable[_-]?key|database[_-]?(?:url|password)|credential)/i;
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const SUPABASE_TOKEN = /\b(?:sbp|sb_secret)_[A-Za-z0-9_-]{16,}\b/g;
const DATABASE_URL = /\bpostgres(?:ql)?:\/\/[^\s"'<>]+/gi;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL = /https?:\/\/[^\s"'<>]+/gi;
const LABELED_SECRET = /\b(authorization|cookie|access[_-]?token|refresh[_-]?token|password|secret|service[_-]?role(?:[_-]?key)?|database[_-]?password)\s*[:=]\s*(?:Bearer\s+)?[^\s,;]+/gi;

function sanitizeUrl(value: string): string {
  try {
    const url = new globalThis.URL(value);
    return `${url.origin}${url.pathname}${url.search || url.hash ? "?[REDACTED]" : ""}`;
  } catch {
    return value;
  }
}

export function redactString(value: string): string {
  return value
    .replace(DATABASE_URL, "[REDACTED_DATABASE_URL]")
    .replace(JWT, "[REDACTED_JWT]")
    .replace(SUPABASE_TOKEN, "[REDACTED_TOKEN]")
    .replace(URL, (match) => sanitizeUrl(match))
    .replace(LABELED_SECRET, (_match, label: string) => `${label}=${REDACTED}`)
    .replace(EMAIL, "[REDACTED_EMAIL]");
}

function sanitizeError(error: Error): Record<string, string> {
  return {
    name: redactString(error.name || "Error"),
    message: redactString(error.message || "An error occurred."),
  };
}

function sanitizeValue(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return `[${typeof value}]`;
  if (value instanceof Error) return sanitizeError(value);
  if (depth >= 8) return "[MAX_DEPTH]";
  if (typeof value !== "object") return redactString(String(value));
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizeValue(item, seen, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    sanitized[key] = SENSITIVE_KEY.test(key)
      ? REDACTED
      : sanitizeValue(nestedValue, seen, depth + 1);
  }
  return sanitized;
}

export function sanitizeLogValue(value: unknown): unknown {
  return sanitizeValue(value, new WeakSet<object>(), 0);
}

const consoleSink: SafeLogSink = {
  write(record) {
    const method = record.level === "error" ? console.error : record.level === "warn" ? console.warn : console.info;
    method("[PrefabHome]", record);
  },
};

export function createSafeLogger(sink: SafeLogSink = consoleSink): SafeLogger {
  function write(level: SafeLogLevel, message: string, context?: unknown) {
    sink.write({
      level,
      message: redactString(message),
      context: context === undefined ? undefined : sanitizeLogValue(context),
      timestamp: new Date().toISOString(),
    });
  }

  return {
    info: (message, context) => write("info", message, context),
    warn: (message, context) => write("warn", message, context),
    error: (message, context) => write("error", message, context),
  };
}

export const safeLogger = createSafeLogger();
