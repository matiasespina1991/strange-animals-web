import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Explicit local regression suite: no credentials, emulators or production writes.
const suites = [
  "recovery-diagnostics",
  "text-ink-modes",
  "design-configurator", "design-history", "canvas-zoom", "workspace-editing", "configurator-assets", "surface-rendering",
  "sleeve-shell", "text-effect-controls", "pressing-rings", "pressing-picker",
  "versioned-model-share", "gallery-save-mode", "model-share-flow", "model-load-progress", "model-thumbnails", "vinyl-model-export", "vinyl-webp-exporter", "sleeve-pbr-paper",
  "layer-context-menu", "layer-panel-order", "multi-font-selection",
  "gallery-navigation", "font-picker", "font-picker-panel", "font-picker-reveal",
  "font-picker-catalog", "configurator-theme", "font-toolbar-casing",
  "font-catalog-visibility", "configurator-preview-auth", "typography-value-control", "async-image-import", "settle-uploads", "foil-windows",
];
const failures = [];
for (const suite of suites) {
  console.log(`\n[configurator] ${suite}`);
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(`./test-${suite}.mjs`, import.meta.url))], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    stdio: "inherit",
    timeout: 120_000,
  });
  if (result.error) console.error(result.error);
  if (result.error || result.status !== 0) failures.push(suite);
}
console.log(`\nConfigurator: ${suites.length - failures.length}/${suites.length} passed.`);
if (failures.length) {
  console.error(`Failed: ${failures.join(", ")}`);
  process.exitCode = 1;
}
