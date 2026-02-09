import { v4 as uuidv4 } from "uuid";
import type { Request, Response, NextFunction } from "express";

const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /api[_-]?key/i,
  /cookie/i,
  /session/i,
];

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_PATTERNS.some((p) => p.test(key));
}

export function redactSensitive(obj: any, depth = 0): any {
  if (depth > 5 || obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitive(item, depth + 1));
  }

  const redacted: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      redacted[key] = typeof value === "string" && value.length > 0
        ? `[REDACTED:${value.length}chars]`
        : "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      redacted[key] = redactSensitive(value, depth + 1);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = (process.env.LOG_LEVEL as LogLevel) || 
  (process.env.NODE_ENV === "production" ? "info" : "debug");

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatLog(level: LogLevel, message: string, data?: Record<string, any>): string {
  if (process.env.NODE_ENV === "production") {
    return JSON.stringify({
      level,
      message,
      timestamp: new Date().toISOString(),
      ...redactSensitive(data || {}),
    });
  }
  const prefix = { debug: "🔍", info: "ℹ️", warn: "⚠️", error: "❌" }[level];
  const dataStr = data ? ` ${JSON.stringify(redactSensitive(data))}` : "";
  return `${prefix} [${level.toUpperCase()}] ${message}${dataStr}`;
}

export const logger = {
  debug(message: string, data?: Record<string, any>) {
    if (shouldLog("debug")) console.log(formatLog("debug", message, data));
  },
  info(message: string, data?: Record<string, any>) {
    if (shouldLog("info")) console.log(formatLog("info", message, data));
  },
  warn(message: string, data?: Record<string, any>) {
    if (shouldLog("warn")) console.warn(formatLog("warn", message, data));
  },
  error(message: string, data?: Record<string, any>) {
    if (shouldLog("error")) console.error(formatLog("error", message, data));
  },
};

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers["x-request-id"] as string) || uuidv4();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}
