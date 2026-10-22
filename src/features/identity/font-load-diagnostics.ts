type Details = Record<string, unknown>;
type ActiveLoad = { id: number; stage: string; startedAt: number; stageAt: number; details: Details };
const active = new Map<number, ActiveLoad>();
let nextId = 0;
const enabled = import.meta.env.DEV;

export function logFontLoad(stage: string, details: Details = {}) {
  if (enabled) console.info(`[Typography/load] ${stage}`, details);
}

// Deliberately store identifiers, paths and timing only: never auth headers/tokens.
if (enabled && typeof window !== "undefined") {
  Object.assign(window, {
    __fontLoadDiagnostics: () => [...active.values()].map(item => ({
      ...item.details, id: item.id, stage: item.stage,
      elapsedMs: Date.now() - item.startedAt, stageElapsedMs: Date.now() - item.stageAt,
    })),
  });
}

export function traceFontLoad(details: Details) {
  const id = ++nextId;
  const startedAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finished = false;
  let currentStage = "";
  const stopTimer = () => { if (timer !== undefined) clearTimeout(timer); };
  const event = (stage: string, extra: Details = {}) => {
    if (!enabled || finished) return;
    const now = Date.now();
    if (stage !== currentStage) {
      stopTimer();
      currentStage = stage;
      active.set(id, { id, stage, startedAt, stageAt: now, details });
      timer = setTimeout(() => {
        console.warn("[Typography/load] Slow stage — still waiting", {
          ...details, id, stage, elapsedMs: Date.now() - startedAt,
          stageElapsedMs: Date.now() - now,
        });
      }, 15_000);
    }
    logFontLoad(stage, { ...details, ...extra, id, elapsedMs: now - startedAt });
  };
  const finish = (stage: "ready" | "cancelled" | "failed", error?: unknown) => {
    if (!enabled || finished) return;
    stopTimer();
    active.delete(id);
    const info = { ...details, id, stage: currentStage, elapsedMs: Date.now() - startedAt };
    if (stage === "failed") console.error("[Typography/load] Failed", info, error);
    else logFontLoad(stage, info);
    finished = true;
  };
  return { event, finish };
}
