import { supabase } from "./supabaseClient";

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  id?: string;
  level: LogLevel;
  message: string;
  details?: any;
  timestamp: string;
  url: string;
  userAgent: string;
}

// Local storage backup for logs if offline
const LOG_STORAGE_KEY = 'sys_error_logs';

export const logger = {
  log: async (level: LogLevel, message: string, details?: any) => {
    const entry: LogEntry = {
      level,
      message,
      details: details ? JSON.stringify(details) : null,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    // 1. Console Output (Dev Mode)
    if (import.meta.env.DEV) {
      console[level](`[${level.toUpperCase()}] ${message}`, details);
    }

    // 2. Try Supabase (Remote Logging)
    try {
      if (supabase) {
        const { error } = await supabase.from('system_logs').insert([entry]);
        if (!error) return; // Success
      }
    } catch (e) {
      // Ignore network errors for logging to avoid loops
    }

    // 3. Fallback: Local Storage (Circular Buffer - keep last 50)
    try {
      const existing = localStorage.getItem(LOG_STORAGE_KEY);
      const logs: LogEntry[] = existing ? JSON.parse(existing) : [];
      logs.push(entry);
      if (logs.length > 50) logs.shift(); // Remove oldest
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
    } catch (e) {
      console.error("Failed to save local log", e);
    }
  },

  info: (msg: string, details?: any) => logger.log('info', msg, details),
  warn: (msg: string, details?: any) => logger.log('warn', msg, details),
  error: (msg: string, details?: any) => logger.log('error', msg, details),

  getLocalLogs: () => {
    try {
      return JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  },

  getSystemLogs: async (): Promise<LogEntry[]> => {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('system_logs')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(100);
        
        if (!error && data) return data as LogEntry[];
      }
    } catch (e) {
      console.error("Failed to fetch remote logs", e);
    }
    // Fallback to local logs
    return logger.getLocalLogs().reverse();
  },

  clearLogs: async () => {
    try {
        localStorage.removeItem(LOG_STORAGE_KEY);
        // Optional: Add remote clear if policy permits
    } catch (e) {
        console.error("Failed to clear logs", e);
    }
  }
};

export const autoHeal = () => {
  // Simple heuristic: If we have > 5 crashes in 1 hour, wipe storage
  const CRASH_KEY = 'crash_count';
  const now = Date.now();
  const crashes = JSON.parse(localStorage.getItem(CRASH_KEY) || '[]');
  
  // Filter crashes from last hour
  const recentCrashes = crashes.filter((t: number) => now - t < 3600000);
  recentCrashes.push(now);
  
  localStorage.setItem(CRASH_KEY, JSON.stringify(recentCrashes));

  if (recentCrashes.length >= 3) {
    logger.warn("Auto-healing triggered: Wiping corrupted data.");
    localStorage.removeItem("barbearia_appointments");
    localStorage.removeItem("barbearia_barbers"); // Risky but necessary if corrupted
    // Keep users to not lockout
    return true;
  }
  return false;
};
