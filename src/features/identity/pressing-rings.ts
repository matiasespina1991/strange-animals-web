import * as THREE from "three";

export const PRESSING_PRESETS = [
  { id: "flat", label: "Flat" },
  { id: "small", label: "Small ring" },
  { id: "triple", label: "Triple ring" },
  { id: "recessed", label: "Wide recessed" },
  { id: "raised", label: "Raised center" },
] as const;
export type PressingPreset = typeof PRESSING_PRESETS[number]["id"];
// Keep restoration data out of geometry.userData: GLTFExporter serializes it.
const baselines = new WeakMap<THREE.BufferGeometry, Float32Array>();

/** Radial relief in model units; ink UVs remain unchanged. */
export function pressingHeight(radius: number, labelRadius: number, preset: PressingPreset) {
  const r = radius / labelRadius;
  if (r < 0.1 || r > 0.94 || preset === "flat") return 0;
  const ring = (center: number, width: number) => Math.exp(-(((r - center) / width) ** 2));
  const edgeFade = THREE.MathUtils.smoothstep(r, 0.1, 0.15) * (1 - THREE.MathUtils.smoothstep(r, 0.88, 0.94));
  const scale = Math.min(1, labelRadius / 0.5);
  const profile = preset === "small" ? -0.00065 * ring(0.27, 0.016)
    : preset === "triple" ? -0.00045 * (ring(0.23, 0.012) + ring(0.34, 0.012) + ring(0.45, 0.012))
    : preset === "recessed" ? -0.00065 * (1 - THREE.MathUtils.smoothstep(r, 0.72, 0.79))
    : 0.00065 * (1 - THREE.MathUtils.smoothstep(r, 0.24, 0.3)) - 0.00045 * ring(0.76, 0.025);
  return profile * edgeFade * scale;
}

export function applyPressingRelief(geometry: THREE.BufferGeometry, labelRadius: number, preset: PressingPreset, face: 1 | -1 | 0) {
  const positions = geometry.getAttribute("position");
  let base = baselines.get(geometry);
  if (!base) {
    base = new Float32Array(positions.array);
    baselines.set(geometry, base);
  }
  for (let i = 0; i < positions.count; i++) {
    const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
    positions.setZ(i, z + pressingHeight(Math.hypot(x, y), labelRadius, preset) * (face || Math.sign(z)));
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}
