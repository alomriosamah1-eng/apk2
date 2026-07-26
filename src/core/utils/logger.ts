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

export interface LoggerTransport {
  log(entry: LogEntry): void;
}

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
      // swallow console errors in production
    }
  }
}

export class Logger {
  private level: LogLevel = 'debug';
  private transports: LoggerTransport[] = [new ConsoleTransport()];

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  addTransport(transport: LoggerTransport): void {
    this.transports.push(transport);
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>, error?: Error): void {
    if (LOG_PRIORITY[level] < LOG_PRIORITY[this.level]) return;

    const entry: LogEntry = {
      level, message,
      timestamp: new Date().toISOString(),
      data, error,
    };

    for (const transport of this.transports) {
      try { transport.log(entry); } catch { /* noop */ }
    }
  }

  debug(message: string, data?: Record<string, unknown>): void { this.log('debug', message, data); }
  info(message: string, data?: Record<string, unknown>): void { this.log('info', message, data); }
  warn(message: string, data?: Record<string, unknown>): void { this.log('warn', message, data); }
  error(message: string, error?: Error, data?: Record<string, unknown>): void { this.log('error', message, data, error); }
  fatal(message: string, error?: Error, data?: Record<string, unknown>): void { this.log('fatal', message, data, error); }
}

export const logger = new Logger();
