import * as THREE from "three";

export const PRESSING_PRESETS = [
  { id: "flat", label: "Flat" },
  { id: "small", label: "Small ring" },
  { id: "raised-hub", label: "Raised hub" },
  { id: "triple", label: "Triple ring" },
  { id: "recessed", label: "Wide recessed" },
  { id: "stepped-double", label: "Stepped double ring" },
  { id: "raised", label: "Raised hub + outer ring" },
] as const;
export type PressingPreset = typeof PRESSING_PRESETS[number]["id"];
// Keep restoration data out of geometry.userData: GLTFExporter serializes it.
const baselines = new WeakMap<THREE.BufferGeometry, Float32Array>();

// Stable tooling marks: irregular spacing, width and pressure rather than a
// repeated wave. The same marks survive preset switching and GLB export.
const pressingMarks = (() => {
  let seed = 7319;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const marks = [];
  for (let radius = 0.135; radius < 0.9; radius += 0.018 + random() * 0.033) {
    marks.push({radius, width: 0.003 + random() * 0.003,
      depth: 0.00001 + random() ** 2 * 0.000035, phase: random() * Math.PI * 2});
  }
  // Add 20% between existing marks without moving or changing the originals.
  const originalCount = marks.length;
  const extraCount = Math.round(originalCount * 0.2);
  for (let i = 0; i < extraCount; i++) {
    const gap = Math.floor((i + 0.5) * (originalCount - 1) / extraCount);
    const radius = THREE.MathUtils.lerp(marks[gap].radius, marks[gap + 1].radius, 0.4 + random() * 0.2);
    marks.push({radius, width: 0.003 + random() * 0.003,
      depth: 0.00001 + random() ** 2 * 0.000035, phase: random() * Math.PI * 2});
  }
  // Additional light impressions across the centre and the intermediate plane.
  for (const radius of [0.112, 0.158, 0.207, 0.267, 0.405, 0.452, 0.51, 0.562]) {
    marks.push({radius, width: 0.0035 + random() * 0.0015,
      depth: 0.000018 + random() * 0.000008, phase: random() * Math.PI * 2});
  }
  for (const mark of marks) {
    if ([0.158, 0.267, 0.452, 0.562].includes(mark.radius)) mark.depth *= 1.625;
  }
  return marks;
})();

/** Pressing relief in model units; ink UVs remain unchanged. */
function pressingProfile(radius: number, labelRadius: number, preset: PressingPreset) {
  const r = radius / labelRadius;
  if (preset === "stepped-double") {
    // Preserve the broad outer recess. The inner ring is the shoulder of a
    // single raised centre extending to the bore, without a groove or washer.
    if (r >= 0.94) return 0;
    const recess = -0.0015 * (1 - THREE.MathUtils.smoothstep(r, 0.61, 0.64));
    const centre = 0.0019 * (1 - THREE.MathUtils.smoothstep(r, 0.344, 0.346));
    return (recess + centre) * Math.min(1, labelRadius / 0.5);
  }
  // A continuous raised centre, not a narrow groove or a torus. Keep the
  // plateau all the way to the bore; only the outer shoulder changes height.
  if (preset === "raised-hub") {
    return 0.001155 * (1 - THREE.MathUtils.smoothstep(r, 0.305 * 0.765, 0.32 * 0.765)) * Math.min(1, labelRadius / 0.5);
  }
  if (r < 0.1 || r > 0.94 || preset === "flat") return 0;
  if (preset === "small") {
    const innerRamp = THREE.MathUtils.smoothstep(r, 0.242, 0.27);
    const outerRamp = 1 - THREE.MathUtils.smoothstep(r, 0.27, 0.276);
    return 0.0005 * innerRamp * outerRamp * Math.min(1, labelRadius / 0.5);
  }
  const ring = (center: number, width: number) => Math.exp(-(((r - center) / width) ** 2));
  const edgeFade = THREE.MathUtils.smoothstep(r, 0.1, 0.15) * (1 - THREE.MathUtils.smoothstep(r, 0.88, 0.94));
  const scale = Math.min(1, labelRadius / 0.5);
  const profile = preset === "triple" ? -0.00045 * (ring(0.23, 0.012) + ring(0.34, 0.012) + ring(0.45, 0.012))
    : preset === "recessed" ? -0.00065 * (1 - THREE.MathUtils.smoothstep(r, 0.72, 0.79))
    : 0.00065 * (1 - THREE.MathUtils.smoothstep(r, 0.24, 0.3)) - 0.00045 * ring(0.76, 0.025);
  return profile * edgeFade * scale * 3;
}

export function pressingHeight(radius: number, labelRadius: number, preset: PressingPreset, angle = 0, marksEnabled = preset === "stepped-double") {
  const profile = pressingProfile(radius, labelRadius, preset);
  if (!marksEnabled) return profile;
  const r = radius / labelRadius;
  // Fine concentric impressions, much shallower than the pressing steps.
  // Fade at the bore, edge and main shoulders so their silhouette stays clean.
  const fade = THREE.MathUtils.smoothstep(r, 0.09, 0.13)
    * (1 - THREE.MathUtils.smoothstep(r, 0.88, 0.94))
    * THREE.MathUtils.smoothstep(Math.abs(r - 0.345), 0.004, 0.018)
    * THREE.MathUtils.smoothstep(Math.abs(r - 0.625), 0.016, 0.03);
  let grooves = 0;
  for (const mark of pressingMarks) {
    const distance = (r - mark.radius) / mark.width;
    if (Math.abs(distance) > 3) continue;
    // Broad, smooth changes in pressure let a mark disappear along its arc.
    const pressure = THREE.MathUtils.smoothstep(
      0.5 + 0.32 * Math.sin(angle * 2 + mark.phase)
        + 0.18 * Math.sin(angle * 5 - mark.phase), 0.22, 0.85,
    );
    grooves -= mark.depth * Math.exp(-distance * distance) * pressure * fade;
  }
  return profile + grooves * Math.min(1, labelRadius / 0.5);
}

export function applyPressingRelief(geometry: THREE.BufferGeometry, labelRadius: number, preset: PressingPreset, face: 1 | -1 | 0, marksEnabled = preset === "stepped-double") {
  const positions = geometry.getAttribute("position");
  let base = baselines.get(geometry);
  if (!base) {
    base = new Float32Array(positions.array);
    baselines.set(geometry, base);
  }
  for (let i = 0; i < positions.count; i++) {
    const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
    positions.setZ(i, z + pressingHeight(Math.hypot(x, y), labelRadius, preset, marksEnabled ? Math.atan2(y, x) : 0, marksEnabled) * (face || Math.sign(z)));
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}
