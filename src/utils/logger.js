const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
};

function detectEnv() {
  // Detectar per hostname: localhost és development, resta és production
  if (typeof window !== "undefined" && window.location) {
    const hostname = window.location.hostname;
    const isLocalhost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname.endsWith(".local");

    if (isLocalhost) {
      return "development";
    }
    return "production";
  }

  if (typeof import.meta !== "undefined" && import.meta.env) {
    if (typeof import.meta.env.MODE === "string") return import.meta.env.MODE;
    if (typeof import.meta.env.NODE_ENV === "string")
      return import.meta.env.NODE_ENV;
  }

  if (typeof window !== "undefined" && typeof window.__APP_ENV__ === "string") {
    return window.__APP_ENV__;
  }

  return "production";
}

let currentLevel =
  detectEnv() === "production" ? LEVELS.warn : LEVELS.debug;

const subscribers = new Set();

function notifySubscribers(level) {
  for (const callback of subscribers) {
    try {
      callback(level);
    } catch {
      // Ignore subscriber errors to avoid breaking logging
    }
  }
}

function resolveConsoleMethod(level) {
  if (typeof console === "undefined") return null;
  if (level === "debug" && typeof console.debug === "function") {
    return console.debug.bind(console);
  }
  if (level === "info" && typeof console.info === "function") {
    return console.info.bind(console);
  }
  if (level === "warn" && typeof console.warn === "function") {
    return console.warn.bind(console);
  }
  if (level === "error" && typeof console.error === "function") {
    return console.error.bind(console);
  }
  return console.log ? console.log.bind(console) : null;
}

function formatPrefix(level, scope) {
  const timestamp = new Date().toISOString();
  if (scope) {
    return [`[${timestamp}] [${scope}] [${level.toUpperCase()}]`];
  }
  return [`[${timestamp}] [${level.toUpperCase()}]`];
}

function shouldLog(level) {
  return LEVELS[level] >= currentLevel && currentLevel < LEVELS.silent;
}

function emit(level, scope, args) {
  if (!shouldLog(level)) return;
  const method = resolveConsoleMethod(level);
  if (!method) return;
  method(...formatPrefix(level, scope), ...args);
}

function createLogger(scope) {
  const scopedScope = scope;
  return {
    debug: (...args) => emit("debug", scopedScope, args),
    info: (...args) => emit("info", scopedScope, args),
    warn: (...args) => emit("warn", scopedScope, args),
    error: (...args) => emit("error", scopedScope, args),
    isEnabled(level = "debug") {
      return shouldLog(level);
    },
    withScope(childScope) {
      const combinedScope = scopedScope
        ? `${scopedScope}:${childScope}`
        : childScope;
      return createLogger(combinedScope);
    },
  };
}

export const logger = {
  ...createLogger("App"),
  setLevel(level) {
    if (!LEVELS[level]) throw new Error(`Nivell de log desconegut: ${level}`);
    currentLevel = LEVELS[level];
    notifySubscribers(level);
  },
  getLevel() {
    const entry = Object.entries(LEVELS).find(
      ([, value]) => value === currentLevel
    );
    return entry ? entry[0] : "debug";
  },
  subscribe(callback) {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  },
  withScope(scope) {
    return createLogger(scope);
  },
};

export const logLevels = Object.freeze({ ...LEVELS });
