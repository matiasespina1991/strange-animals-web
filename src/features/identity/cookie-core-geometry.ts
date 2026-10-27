import * as THREE from "three";

export function createCookieCoreGeometry(radius: number, holeRadius: number, depth: number, bevelSize: number, bevelThickness: number) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius - bevelSize, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  // ExtrudeGeometry's bevel grows into holes. Compensate so the black core
  // never intrudes into the printed opening and appears as a front-facing ring.
  hole.absarc(0, 0, holeRadius + bevelSize, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const coreDepth = depth - bevelThickness * 2;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: coreDepth, bevelEnabled: true, bevelSegments: 4,
    bevelSize, bevelThickness, curveSegments: 128,
  });
  geometry.translate(0, 0, -coreDepth / 2);
  const positions = geometry.getAttribute("position");
  const groups = [...geometry.groups];
  geometry.clearGroups();
  for (const group of groups) {
    if (group.materialIndex === 0) {
      geometry.addGroup(group.start, group.count, 0);
      continue;
    }
    for (let i = group.start; i < group.start + group.count; i += 3) {
      // Keep only the recessed bore black; the outer rim follows the paper ink.
      const bore = Math.hypot(positions.getX(i), positions.getY(i)) < (holeRadius + radius) / 2;
      const materialIndex = bore ? 2 : 1;
      const last = geometry.groups.at(-1);
      if (last && last.materialIndex === materialIndex && last.start + last.count === i) last.count += 3;
      else geometry.addGroup(i, 3, materialIndex);
    }
  }
  return geometry;
}
