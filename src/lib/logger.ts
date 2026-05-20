const prefix = '[ChatStamp]';
let debugEnabled = false;

export const logger = {
  setDebugEnabled(enabled: boolean) {
    debugEnabled = enabled;
  },
  info(message: string, details?: unknown) {
    write(console.log, message, details);
  },
  debug(message: string, details?: unknown) {
    if (!debugEnabled) return;
    write(console.log, message, details);
  },
  warn(message: string, details?: unknown) {
    write(console.warn, message, details);
  },
  error(message: string, details?: unknown) {
    write(console.error, message, details);
  }
};

function write(writer: (message?: unknown, ...optionalParams: unknown[]) => void, message: string, details?: unknown) {
  if (details === undefined) {
    writer(`${prefix} ${message}`);
    return;
  }

  writer(`${prefix} ${message}`, details);
}
