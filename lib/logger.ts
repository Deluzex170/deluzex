/**
 * Deluzex High-Fidelity Isomorphic Logger
 * Supports styled DevTools badges in browser and ANSI formatting in Node.js
 */

type LogLevel = "INFO" | "SUCCESS" | "WARN" | "ERROR" | "DEBUG";

interface ApiLogOptions {
  method: string;
  url: string;
  status: number;
  durationMs: number;
  reqData?: unknown;
  resData?: unknown;
  error?: unknown;
}

const isBrowser = typeof window !== "undefined";

// ─── Browser Badge Styles ───
const BRAND_BADGE = "background: #0f172a; color: #c49a45; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-family: system-ui, sans-serif; font-size: 10px;";
const RESET_STYLE = "background: transparent; color: inherit; font-family: inherit;";

const LEVEL_STYLES: Record<LogLevel, string> = {
  INFO: "background: #0284c7; color: #ffffff; font-weight: 600; padding: 2px 6px; border-radius: 4px; font-size: 10px;",
  SUCCESS: "background: #059669; color: #ffffff; font-weight: 600; padding: 2px 6px; border-radius: 4px; font-size: 10px;",
  WARN: "background: #d97706; color: #ffffff; font-weight: 600; padding: 2px 6px; border-radius: 4px; font-size: 10px;",
  ERROR: "background: #dc2626; color: #ffffff; font-weight: 600; padding: 2px 6px; border-radius: 4px; font-size: 10px;",
  DEBUG: "background: #7c3aed; color: #ffffff; font-weight: 600; padding: 2px 6px; border-radius: 4px; font-size: 10px;",
};

const TAG_STYLE = "background: #334155; color: #f8fafc; font-weight: 500; padding: 2px 6px; border-radius: 4px; font-size: 10px;";

function getMethodStyle(method: string): string {
  const m = method.toUpperCase();
  if (m === "GET") return "background: #064e3b; color: #a7f3d0; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 10px;";
  if (m === "POST") return "background: #1e3a8a; color: #bfdbfe; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 10px;";
  if (m === "PUT" || m === "PATCH") return "background: #713f12; color: #fef08a; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 10px;";
  if (m === "DELETE") return "background: #881337; color: #fecdd3; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 10px;";
  return "background: #475569; color: #ffffff; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 10px;";
}

function getStatusStyle(status: number): string {
  if (status >= 200 && status < 300) return "background: #065f46; color: #6ee7b7; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 10px;";
  if (status >= 300 && status < 400) return "background: #0e7490; color: #67e8f9; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 10px;";
  if (status >= 400 && status < 500) return "background: #78350f; color: #fde68a; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 10px;";
  return "background: #7f1d1d; color: #fca5a5; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 10px;";
}

function getDurationColor(durationMs: number): string {
  if (durationMs < 100) return "color: #10b981; font-weight: 600;";
  if (durationMs < 500) return "color: #f59e0b; font-weight: 600;";
  return "color: #ef4444; font-weight: 600;";
}

class Logger {
  private formatTimestamp(): string {
    const d = new Date();
    return d.toTimeString().split(" ")[0] + "." + String(d.getMilliseconds()).padStart(3, "0");
  }

  private shouldLog(): boolean {
    if (isBrowser) {
      try {
        return window.localStorage.getItem("DELUZEX_DEBUG") === "true";
      } catch {
        return false;
      }
    }
    return process.env.NODE_ENV !== "production";
  }

  private print(level: LogLevel, tag: string, message: string, ...args: unknown[]) {
    if (!this.shouldLog()) return;
    const time = this.formatTimestamp();

    if (isBrowser) {
      console.log(
        `%cDELUZEX%c %c${level}%c %c${tag}%c [${time}] ${message}`,
        BRAND_BADGE,
        RESET_STYLE,
        LEVEL_STYLES[level],
        RESET_STYLE,
        TAG_STYLE,
        RESET_STYLE,
        ...args
      );
    } else {
      const colors: Record<LogLevel, string> = {
        INFO: "\x1b[36m",
        SUCCESS: "\x1b[32m",
        WARN: "\x1b[33m",
        ERROR: "\x1b[31m",
        DEBUG: "\x1b[35m",
      };
      const color = colors[level] || "\x1b[37m";
      console.log(`\x1b[38;2;196;154;69m[DELUZEX]\x1b[0m ${color}[${level}]\x1b[0m \x1b[90m${tag}\x1b[0m [${time}] ${message}`, ...args);
    }
  }

  info(tag: string, message: string, ...args: unknown[]) {
    this.print("INFO", tag, message, ...args);
  }

  success(tag: string, message: string, ...args: unknown[]) {
    this.print("SUCCESS", tag, message, ...args);
  }

  warn(tag: string, message: string, ...args: unknown[]) {
    this.print("WARN", tag, message, ...args);
  }

  error(tag: string, message: string, ...args: unknown[]) {
    this.print("ERROR", tag, message, ...args);
  }

  debug(tag: string, message: string, ...args: unknown[]) {
    if (this.shouldLog()) {
      this.print("DEBUG", tag, message, ...args);
    }
  }

  /**
   * Log an API request/response with visual badges and expandable group payload
   */
  api({ method, url, status, durationMs, reqData, resData, error }: ApiLogOptions) {
    if (!this.shouldLog()) return;
    const isError = status >= 400 || !!error;
    const groupFn = isError ? console.group : console.groupCollapsed;

    if (isBrowser) {
      groupFn(
        `%cDELUZEX API%c %c ${method.toUpperCase()} %c %c ${status || "ERR"} %c ${url} %c${durationMs.toFixed(1)}ms%c`,
        BRAND_BADGE,
        RESET_STYLE,
        getMethodStyle(method),
        RESET_STYLE,
        getStatusStyle(status || 500),
        RESET_STYLE,
        getDurationColor(durationMs),
        RESET_STYLE
      );

      console.log("Endpoint:", url);
      console.log("Method:", method.toUpperCase());
      console.log("Status:", status);
      console.log("Latency:", `${durationMs.toFixed(2)} ms`);

      if (reqData !== undefined) {
        console.log("Request Payload:", reqData);
      }
      if (resData !== undefined) {
        console.log("Response Data:", resData);
      }
      if (error) {
        console.error("API Error Detail:", error);
      }

      console.groupEnd();
    } else {
      const statusStr = status >= 200 && status < 300 ? `\x1b[32m${status}\x1b[0m` : `\x1b[31m${status}\x1b[0m`;
      console.log(`\x1b[38;2;196;154;69m[DELUZEX API]\x1b[0m ${method.toUpperCase()} ${url} -> ${statusStr} (${durationMs.toFixed(1)}ms)`);
      if (error) {
        console.error(error);
      }
    }
  }

  /**
   * Prints the luxury Deluzex developer banner on client initialization
   */
  banner() {
    if (!isBrowser || !this.shouldLog()) return;

    const bannerTitle = "  ✦ DELUZEX LIGHTING — Where Light Becomes Design ✦  ";
    const bannerSubtitle = "  Luxury Architectural Lighting • Developer Console Logger Active  ";
    
    console.log(
      `%c${bannerTitle}\n%c${bannerSubtitle}`,
      "background: linear-gradient(90deg, #0B0B0B 0%, #1A1A1A 50%, #0B0B0B 100%); color: #C49A45; font-family: 'Cinzel', 'Libre Caslon Display', serif, system-ui; font-size: 13px; font-weight: bold; padding: 8px 16px; border-radius: 6px 6px 0 0; border: 1px solid rgba(196, 154, 69, 0.4); text-shadow: 0 0 10px rgba(196, 154, 69, 0.5);",
      "background: #111111; color: #A0A0A0; font-family: 'General Sans', system-ui, sans-serif; font-size: 11px; padding: 6px 16px; border-radius: 0 0 6px 6px; border-left: 1px solid rgba(196, 154, 69, 0.4); border-right: 1px solid rgba(196, 154, 69, 0.4); border-bottom: 1px solid rgba(196, 154, 69, 0.4);"
    );
  }
}

export const logger = new Logger();
export default logger;
