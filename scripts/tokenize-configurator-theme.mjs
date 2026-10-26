// Mechanical, idempotent CSS migration. Light-mode literals remain as fallbacks.
import { readFileSync, writeFileSync } from "node:fs";
import postcss from "postcss";

const files = ["src/features/identity/design-configurator.css", "src/features/identity/design-configurator-mobile.css"];
const preservedPreview = /\.dc-(?:asset-preview|asset-brand|barcode-preview|template-preview|disc|sleeve-background)(?![\w-])/;
for (const file of files) {
  const css = postcss.parse(readFileSync(file, "utf8"));
  let changed = 0;
  css.walkDecls(decl => {
    if (decl.value.includes("var(--dc-") || decl.prop.startsWith("--")) return;
    const selector = decl.parent.type === "rule" ? decl.parent.selector : "";
    if (preservedPreview.test(selector)) return;
    if (decl.prop === "color-scheme") { decl.value = "var(--dc-color-scheme, light)"; changed++; return; }
    if (!/^(?:color|background(?:-color|-image)?|border(?:-(?:top|right|bottom|left))?(?:-color)?|outline(?:-color)?|accent-color|caret-color|scrollbar-color)$/.test(decl.prop)) return;
    decl.value = decl.value.replace(/#[\da-f]{6}\b|#[\da-f]{3}\b/gi, literal => {
      const hex = literal.length === 4 ? literal.slice(1).split("").map(c => c + c).join("") : literal.slice(1);
      const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
      const luminance = (r * .299 + g * .587 + b * .114) / 255;
      let role;
      if (decl.prop === "accent-color" || decl.prop.startsWith("outline")) role = "accent";
      else if (/border|scrollbar/.test(decl.prop)) role = luminance < .42 ? "accent" : /border-(?:top|bottom)/.test(decl.prop) ? "divider" : "border";
      else if (decl.prop.includes("background")) {
        role = /warning|error/.test(selector) ? "warning-bg"
          : luminance < .3 ? "action-bg"
          : selector.trim() === ".design-configurator" ? "bg"
          : /artboard/.test(selector) ? "workspace"
          : /:hover/.test(selector) ? "hover"
          : /aria-pressed|selected|active/.test(selector) ? "selected"
          : hex.toLowerCase() === "ffffff" ? "input-bg"
          : luminance > .95 ? "panel" : "surface-muted";
      } else {
        role = /warning|error/.test(selector) ? "warning-text"
          : luminance > .9 ? "on-action"
          : /font-star|font-group|category-label|discovery-note/.test(selector) ? "accent"
          : luminance < .3 ? "text" : "muted";
      }
      changed++;
      return `var(--dc-${role}, ${literal})`;
    });
  });
  // The workspace grid is UI chrome, not part of the exported artwork.
  css.walkRules(".dc-artboard", rule => rule.walkDecls("background-image", decl => {
    if (decl.value.includes("--dc-grid")) return;
    decl.value = decl.value.replaceAll("rgba(86, 94, 79, 0.08)", "var(--dc-grid, rgba(86, 94, 79, 0.08))");
  }));
  writeFileSync(file, css.toString());
  console.log(`${file}: ${changed} UI color literals tokenized.`);
}
