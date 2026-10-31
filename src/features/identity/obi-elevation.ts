import * as THREE from "three";

export type ObiBand = { enabled: boolean; start: number; width: number; heightMm: number };
export type ObiBands = Partial<Record<"A" | "B", ObiBand>>;
type Point = [number, number];

/** Clip the existing printed cap, retaining its window and continuous artwork UVs. */
export function createObiElevation(
  cap: THREE.BufferGeometry, size: number, faceZ: number,
  back: boolean, band: ObiBand, material: THREE.Material,
): THREE.Mesh | undefined {
  if (!band.enabled || band.heightMm <= 0) return;
  const start = THREE.MathUtils.clamp(band.start, 0, 100);
  const end = Math.min(100, start + THREE.MathUtils.clamp(band.width, 1, 100));
  let left = (start / 100 - 0.5) * size;
  let right = (end / 100 - 0.5) * size;
  if (back) [left, right] = [-right, -left];
  const face = back ? -1 : 1;
  const height = Math.min(0.5, band.heightMm) * size / 315;
  const top = faceZ + face * height;
  const vertices: number[] = [], uvs: number[] = [];
  const boundaries = new Map<string, [Point, Point]>();
  const key = (p: Point) => `${p[0].toFixed(7)},${p[1].toFixed(7)}`;
  const push = (p: Point, z: number) => {
    vertices.push(p[0], p[1], z);
    uvs.push(p[0] / size + 0.5, p[1] / size + 0.5);
  };
  const triangle = (a: Point, b: Point, c: Point, z: number) => {
    push(a, z); push(b, z); push(c, z);
  };
  const clip = (polygon: Point[], bound: number, greater: boolean) => {
    const result: Point[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const insideA = greater ? a[0] >= bound : a[0] <= bound;
      const insideB = greater ? b[0] >= bound : b[0] <= bound;
      if (insideA) result.push(a);
      if (insideA !== insideB) {
        const t = (bound - a[0]) / (b[0] - a[0]);
        result.push([bound, a[1] + t * (b[1] - a[1])]);
      }
    }
    return result;
  };
  const positions = cap.getAttribute("position");
  const normals = cap.getAttribute("normal");
  for (let i = 0; i < positions.count; i += 3) {
    if (normals.getZ(i) * face < 0.999) continue;
    let polygon: Point[] = [0, 1, 2].map(offset =>
      [positions.getX(i + offset), positions.getY(i + offset)]);
    polygon = clip(clip(polygon, left, true), right, false);
    if (polygon.length < 3) continue;
    for (let j = 1; j < polygon.length - 1; j++) triangle(polygon[0], polygon[j], polygon[j + 1], top);
    for (let j = 0; j < polygon.length; j++) {
      const a = polygon[j], b = polygon[(j + 1) % polygon.length];
      const ka = key(a), kb = key(b);
      if (ka === kb) continue;
      const edge = [ka, kb].sort().join("|");
      if (boundaries.has(edge)) boundaries.delete(edge);
      else boundaries.set(edge, [a, b]);
    }
  }
  for (const [a, b] of boundaries.values()) {
    push(a, top); push(a, faceZ); push(b, faceZ);
    push(a, top); push(b, faceZ); push(b, top);
  }
  if (!vertices.length) return;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `${back ? "Back" : "Front"} experimental OBI`;
  return mesh;
}
