import "server-only";

const TRACE_PREFIX = "[AskTheMenu trace]";
const DEFAULT_MAX_CHARS = 20_000;

function isTraceEnabled() {
  return process.env.LLM_TRACE !== "0";
}

function getMaxChars() {
  const parsed = Number.parseInt(process.env.LLM_TRACE_MAX_CHARS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_CHARS;
}

function sanitize(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (/api[-_]?key|authorization|token|secret|password/i.test(key)) {
        return [key, "[redacted]"];
      }

      return [key, sanitize(entry)];
    })
  );
}

function stringify(value: unknown) {
  const maxChars = getMaxChars();
  const text = JSON.stringify(sanitize(value), null, 2);

  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars)}\n...[truncated ${text.length - maxChars} chars]`;
}

export function traceLog(event: string, payload?: unknown) {
  if (!isTraceEnabled()) {
    return;
  }

  if (payload === undefined) {
    console.info(`${TRACE_PREFIX} ${event}`);
    return;
  }

  console.info(`${TRACE_PREFIX} ${event}\n${stringify(payload)}`);
}

export function traceWarn(event: string, payload?: unknown) {
  if (!isTraceEnabled()) {
    return;
  }

  if (payload === undefined) {
    console.warn(`${TRACE_PREFIX} ${event}`);
    return;
  }

  console.warn(`${TRACE_PREFIX} ${event}\n${stringify(payload)}`);
}

export function traceError(event: string, payload?: unknown) {
  if (!isTraceEnabled()) {
    return;
  }

  if (payload === undefined) {
    console.error(`${TRACE_PREFIX} ${event}`);
    return;
  }

  console.error(`${TRACE_PREFIX} ${event}\n${stringify(payload)}`);
}
