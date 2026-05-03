type Level = "debug" | "info" | "silent";

const ORDER: Record<Level, number> = { debug: 0, info: 1, silent: 2 };

function currentLevel(): Level {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "silent") return raw;
  return "info";
}

function should(level: Level): boolean {
  return ORDER[level] >= ORDER[currentLevel()];
}

export const log = {
  debug: (...args: unknown[]) => {
    if (should("debug")) console.log("[debug]", ...args);
  },
  info: (...args: unknown[]) => {
    if (should("info")) console.log("[info]", ...args);
  },
  error: (...args: unknown[]) => {
    console.error("[error]", ...args);
  },
};
