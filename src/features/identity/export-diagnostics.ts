type Details = Record<string, string | number | boolean | undefined>;

/** No project text, images, credentials or embedded font bytes belong in logs. */
export function createExportDiagnostics(metadata: Details) {
  const exportId = crypto.randomUUID();
  const started = performance.now();
  let stage = "start";
  const context = () => ({ ...metadata, exportId, stage, elapsedMs: Math.round(performance.now() - started) });
  console.info("[DesignConfigurator/export] Started", context());
  return {
    stage(next: string, details: Details = {}) {
      stage = next;
      console.info("[DesignConfigurator/export] Progress", { ...context(), ...details });
    },
    fail(error: unknown) {
      console.error("[DesignConfigurator/export] Failed", context(), error);
    },
    complete() {
      stage = "complete";
      console.info("[DesignConfigurator/export] Completed", context());
    },
  };
}
