import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createPrintedBoardGrain } from "./sleeve-material";

function appendMaterialGroup(geometry: THREE.BufferGeometry, start: number, materialIndex: number) {
  const last = geometry.groups.at(-1);
  if (last && last.materialIndex === materialIndex && last.start + last.count === start) last.count += 3;
  else geometry.addGroup(start, 3, materialIndex);
}

/** Thin paperboard panels, three folded edges and an open right-hand mouth. */
export function createSleeveShell(size: number, depth: number, openingRadius: number, front: THREE.Texture, back: THREE.Texture, color: string, windows = {A: true, B: true}, material: "matte" | "printed-board" | "printed-board-glossy" = "matte") {
  const shell = new THREE.Group();
  shell.name = "Paperboard sleeve (open right edge)";
  const thickness = Math.min(0.003, depth / 6);
  const radius = thickness * 0.4;
  const half = size / 2;
  const faceHalf = half - radius;
  const shape = new THREE.Shape();
  shape.moveTo(-faceHalf, -faceHalf);
  shape.lineTo(faceHalf, -faceHalf);
  shape.lineTo(faceHalf, faceHalf);
  shape.lineTo(-faceHalf, faceHalf);
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, openingRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const board = new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 });
  const interior = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.55), roughness: 1, metalness: 0 });
  const prints = [front, back].map(map => new THREE.MeshPhysicalMaterial({ map, roughness: 0.72, metalness: 0, clearcoat: 0.025, clearcoatRoughness: 0.8 }));
  {
    const glossy = material === "printed-board-glossy";
    const matte = material === "matte";
    const grain = createPrintedBoardGrain();
    for (const print of prints) {
      print.roughness = matte ? 0.72 : glossy ? 0.36 : 0.48;
      print.clearcoat = matte ? 0.025 : glossy ? 0.4 : 0.12;
      print.clearcoatRoughness = matte ? 0.8 : glossy ? 0.32 : 0.5;
      print.envMapIntensity = matte ? 0.5 : glossy ? 0.7 : 0.65;
      print.normalMap = grain;
      const textureStrength = matte ? 0.16 : glossy ? 0.08 : 0.12;
      print.normalScale.set(textureStrength, textureStrength);
    }
  }
  for (const isBack of [false, true]) {
    shape.holes = (isBack ? windows.B : windows.A) ? [hole] : [];
    // Sub-millimetre paper edge, not the old broad chamfer. Printed UVs continue
    // over the outer curves; only the cut edge of the center hole stays bare.
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness - 2 * radius, bevelEnabled: true, bevelSize: radius, bevelThickness: radius, bevelSegments: 5, curveSegments: 64 });
    geometry.translate(0, 0, radius);
    const position = geometry.getAttribute("position");
    const uv = geometry.getAttribute("uv");
    const cap = geometry.groups.find(group => group.materialIndex === 0)!;
    const edge = geometry.groups.find(group => group.materialIndex === 1)!;
    for (let i = 0; i < position.count; i++) {
      uv.setXY(i, THREE.MathUtils.clamp((position.getX(i) + half) / size, 0, 1), THREE.MathUtils.clamp((position.getY(i) + half) / size, 0, 1));
    }
    const faceCount = cap.count / 2;
    geometry.clearGroups();
    geometry.addGroup(cap.start, faceCount, isBack ? 0 : 1);
    geometry.addGroup(cap.start + faceCount, faceCount, isBack ? 1 : 0);
    for (let i = edge.start; i < edge.start + edge.count; i += 3) {
      const cutHole = Math.hypot(position.getX(i), position.getY(i)) < openingRadius + 2 * radius;
      appendMaterialGroup(geometry, i, cutHole ? 2 : 0);
    }
    const print = prints[isBack ? 1 : 0];
    const panel = new THREE.Mesh(geometry, [print, interior, board]);
    panel.name = isBack ? "Back paperboard" : "Front paperboard";
    panel.position.z = isBack ? -depth / 2 : depth / 2 - thickness;
    shell.add(panel);
  }
  const fold = (name: string, width: number, height: number, x: number, y: number) => {
    const geometry = new RoundedBoxGeometry(width, height, depth - thickness * 2, 5, radius);
    const positions = geometry.getAttribute("position");
    const uv = geometry.getAttribute("uv");
    geometry.clearGroups();
    for (let i = 0; i < positions.count; i++) {
      uv.setXY(i, THREE.MathUtils.clamp((positions.getX(i) + x + half) / size, 0, 1), THREE.MathUtils.clamp((positions.getY(i) + y + half) / size, 0, 1));
    }
    for (let i = 0; i < positions.count; i += 3) {
      const z = (positions.getZ(i) + positions.getZ(i + 1) + positions.getZ(i + 2)) / 3;
      appendMaterialGroup(geometry, i, z < 0 ? 1 : 0);
    }
    const mesh = new THREE.Mesh(geometry, prints);
    mesh.name = name;
    mesh.position.set(x, y, 0);
    shell.add(mesh);
  };
  fold("Spine fold", thickness, size, -half + thickness / 2, 0);
  fold("Top fold", size - thickness, thickness, thickness / 2, half - thickness / 2);
  fold("Bottom fold", size - thickness, thickness, thickness / 2, -half + thickness / 2);
  return shell;
}
