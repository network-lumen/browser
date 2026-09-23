/** How loud one recorded line was. */
export type AppLogLevel = 'log' | 'info' | 'warn' | 'error';

/** One line in the in-app log buffer - see src/internal/services/appLog.ts. */
export interface AppLogEntry {
  id: number;
  at: number;
  level: AppLogLevel;
  message: string;
}
