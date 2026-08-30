export interface StarlimsLogger {
  debug(message: string, detail?: unknown): void;
  info(message: string, detail?: unknown): void;
  error(message: string, detail?: unknown): void;
}

const SENSITIVE_ASSIGNMENT = /((?:password|pass|token|cookie|secret|authorization|starlimspass)\s*[=:]\s*)([^\s,;]+)/gi;
const SENSITIVE_JSON = /(\"(?:password|pass|token|cookie|secret|authorization|starlimspass)\"\s*:\s*\")[^\"]*(\")/gi;

export function redactLogValue(value: unknown, secrets: readonly string[] = []): string {
  let text: string;
  try {
    text = typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    text = String(value);
  }
  text = text.replace(SENSITIVE_ASSIGNMENT, '$1[REDACTED]').replace(SENSITIVE_JSON, '$1[REDACTED]$2');
  for (const secret of secrets.filter((candidate) => candidate.length >= 3)) text = text.split(secret).join('[REDACTED]');
  return text;
}

export function createStderrLogger(options: { debug?: boolean; secrets?: readonly string[] } = {}): StarlimsLogger {
  const write = (level: string, message: string, detail?: unknown): void => {
    const suffix = detail === undefined ? '' : ` ${redactLogValue(detail, options.secrets)}`;
    process.stderr.write(`[starlims-mcp] ${level} ${redactLogValue(message, options.secrets)}${suffix}\n`);
  };
  return {
    debug: (message, detail) => { if (options.debug) write('DEBUG', message, detail); },
    info: (message, detail) => write('INFO', message, detail),
    error: (message, detail) => write('ERROR', message, detail)
  };
}
