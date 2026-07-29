type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LOG_PRIORITY: Record<LogLevel, number> = {
  debug: 0, info: 1, warn: 2, error: 3, fatal: 4,
};

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  error?: Error;
  data?: Record<string, unknown>;
}

interface LogOptions {
  data?: Record<string, unknown>;
  error?: Error;
}

export interface LoggerTransport {
  log(entry: LogEntry): void;
}

/* eslint-disable no-console */

class ConsoleTransport implements LoggerTransport {
  log(entry: LogEntry): void {
    const prefix = `[${entry.timestamp.slice(11, 23)}] [${entry.level.toUpperCase()}]`;
    const msg = `${prefix} ${entry.message}`;

    try {
      switch (entry.level) {
        case 'error':
        case 'fatal':
          console.error(msg, entry.error ?? '', entry.data ?? '');
          break;
        case 'warn':
          console.warn(msg, entry.data ?? '');
          break;
        default:
          console.log(msg, entry.data ?? '');
          break;
      }
    } catch {
      /* noop */
    }
  }
}

/* eslint-enable no-console */

export class Logger {
  private level: LogLevel = 'debug';
  private transports: LoggerTransport[] = [new ConsoleTransport()];

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  addTransport(transport: LoggerTransport): void {
    this.transports.push(transport);
  }

  private write(level: LogLevel, message: string, options?: LogOptions): void {
    if (LOG_PRIORITY[level] < LOG_PRIORITY[this.level]) return;

    const entry: LogEntry = {
      level, message,
      timestamp: new Date().toISOString(),
      data: options?.data,
      error: options?.error,
    };

    for (const transport of this.transports) {
      try { transport.log(entry); } catch { /* noop */ }
    }
  }

  debug(message: string, data?: Record<string, unknown>): void { this.write('debug', message, { data }); }
  info(message: string, data?: Record<string, unknown>): void { this.write('info', message, { data }); }
  warn(message: string, data?: Record<string, unknown>): void { this.write('warn', message, { data }); }
  error(message: string, error?: Error, data?: Record<string, unknown>): void { this.write('error', message, { error, data }); }
  fatal(message: string, error?: Error, data?: Record<string, unknown>): void { this.write('fatal', message, { error, data }); }
}

export const logger = new Logger();
