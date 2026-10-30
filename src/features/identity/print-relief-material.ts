import * as THREE from "three";

export type ReliefMasks = {
  uv: string;
  emboss: string;
  deboss: string;
  ink?: string;
};
export type SurfaceReliefMasks = {
  A: ReliefMasks;
  B: ReliefMasks;
  sleeveA: ReliefMasks;
  sleeveB: ReliefMasks;
};

function surfacePixels(texture: THREE.Texture | null) {
  const image = texture?.image as
    | { data?: Uint8Array; width: number; height: number; getContext?: unknown }
    | undefined;
  if (!image) return undefined;
  if (image.data) return image;
  if (typeof image.getContext === "function") {
    const context = (image as unknown as HTMLCanvasElement).getContext("2d", {
      willReadFrequently: true,
    });
    if (context)
      return {
        data: context.getImageData(0, 0, image.width, image.height).data,
        width: image.width,
        height: image.height,
      };
  }
  return undefined;
}

/** One-texel Gaussian reconstruction before differentiating, not artwork blur. */
export function smoothReliefHeight(height: Float32Array, size: number) {
  const horizontal = new Float32Array(height.length),
    result = new Float32Array(height.length);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      horizontal[i] =
        (height[y * size + Math.max(0, x - 1)] +
          2 * height[i] +
          height[y * size + Math.min(size - 1, x + 1)]) /
        4;
    }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      result[i] =
        (horizontal[Math.max(0, y - 1) * size + x] +
          2 * horizontal[i] +
          horizontal[Math.min(size - 1, y + 1) * size + x]) /
        4;
    }
  return result;
}

/** Shallow paper relief in millimetres; normals remain portable in standard GLB. */
export function reliefNormalPixels(
  height: Float32Array,
  size: number,
  surfaceMm: number,
) {
  height = smoothReliefHeight(height, size);
  const pixels = new Uint8Array(size * size * 4);
  const at = (x: number, y: number) =>
    height[
      Math.max(0, Math.min(size - 1, y)) * size +
        Math.max(0, Math.min(size - 1, x))
    ];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      // Sobel derivatives give a stable rounded transition over antialiased edges.
      const dx =
        (at(x + 1, y - 1) +
          2 * at(x + 1, y) +
          at(x + 1, y + 1) -
          (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1))) /
        8;
      const dy =
        (at(x - 1, y + 1) +
          2 * at(x, y + 1) +
          at(x + 1, y + 1) -
          (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1))) /
        8;
      const nx = (-dx * size) / surfaceMm,
        ny = (dy * size) / surfaceMm;
      const length = Math.hypot(nx, ny, 1),
        i = (y * size + x) * 4;
      pixels[i] = Math.round(((nx / length) * 0.5 + 0.5) * 255);
      pixels[i + 1] = Math.round(((ny / length) * 0.5 + 0.5) * 255);
      pixels[i + 2] = Math.round(((1 / length) * 0.5 + 0.5) * 255);
      pixels[i + 3] = 255;
    }
  return pixels;
}

export function applyPrintRelief(
  material: THREE.MeshPhysicalMaterial,
  images: Partial<Record<keyof ReliefMasks, HTMLImageElement>>,
  surfaceMm: number,
  flip = false,
) {
  const previousNormalMap = material.normalMap;
  const size = Math.min(
    2048,
    Math.max(
      ...Object.values(images).map((image) => image.naturalWidth || 2048),
      1,
    ),
  );
  const height = new Float32Array(size * size),
    uv = new Float32Array(size * size);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw Error("Canvas unavailable for print relief.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  for (const key of ["uv", "emboss", "deboss", "ink"] as const) {
    const image = images[key];
    if (!image) continue;
    context.clearRect(0, 0, size, size);
    context.save();
    if (flip) {
      context.translate(size, 0);
      context.scale(-1, 1);
    }
    context.drawImage(image, 0, 0, size, size);
    context.restore();
    const data = context.getImageData(0, 0, size, size).data;
    const layerHeight =
      key === "ink" ? new Float32Array(height.length) : height;
    for (let p = 0; p < height.length; p++) {
      const coverage = ((data[p * 4] / 255) * data[p * 4 + 3]) / 255;
      layerHeight[p] +=
        coverage * (key === "ink" ? 0.009 : 1.6) * (key === "deboss" ? -1 : 1);
      if (key === "uv") uv[p] = Math.min(1, coverage * 20);
    }
    if (key === "ink") {
      // Round only the ink's shoulders, leaving artwork and explicit finishes sharp.
      const softInk = smoothReliefHeight(
        smoothReliefHeight(layerHeight, size),
        size,
      );
      for (let p = 0; p < height.length; p++) height[p] += softInk[p];
    }
  }
  const texture = (data: Uint8Array, name: string): THREE.Texture => {
    // Keep every finish map canvas-backed. GLTFExporter applies flipY with
    // drawImage; its DataTexture putImageData path ignores that transform,
    // otherwise gloss and relief end up vertically misregistered in GLB.
    const target = document.createElement("canvas");
    target.width = target.height = size;
    const targetContext = target.getContext("2d");
    if (!targetContext)
      throw Error("Canvas unavailable for exportable roughness.");
    const pixels = targetContext.createImageData(size, size);
    pixels.data.set(data);
    targetContext.putImageData(pixels, 0, 0);
    const map = new THREE.CanvasTexture(target);
    map.name = name;
    map.flipY = true;
    map.magFilter = THREE.LinearFilter;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.generateMipmaps = true;
    map.needsUpdate = true;
    return map;
  };
  // Preserve fine stock grain where present, while adding the relief normals.
  const normals = reliefNormalPixels(height, size, surfaceMm);
  console.log("[PrintRelief] Normal map:", material.normalMap);
  console.log("[PrintRelief] Image:", material.normalMap?.image);
  const grain = surfacePixels(material.normalMap);
  if (grain?.data && grain.width && grain.height) {
    const repeat = material.normalMap!.repeat;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const g =
          ((Math.floor((y / size) * grain.height * repeat.y) % grain.height) *
            grain.width +
            (Math.floor((x / size) * grain.width * repeat.x) % grain.width)) *
          4;
        const i = (y * size + x) * 4;
        normals[i] = Math.max(
          0,
          Math.min(
            255,
            normals[i] + (grain.data[g] - 128) * material.normalScale.x,
          ),
        );
        normals[i + 1] = Math.max(
          0,
          Math.min(
            255,
            normals[i + 1] + (grain.data[g + 1] - 128) * material.normalScale.y,
          ),
        );
      }
  }
  // The original stock texture can be shared by both sleeve faces. Its owner
  // keeps it alive until preview cleanup; do not dispose it here.
  material.normalMap = texture(normals, "Print finish relief normals");
  material.normalScale.set(1, 1);
  if (images.uv) {
    const stockRoughness = surfacePixels(material.roughnessMap);
    const roughness = new Uint8Array(size * size * 4),
      coat = new Uint8Array(size * size * 4);
    for (let p = 0; p < uv.length; p++) {
      const x = p % size,
        y = Math.floor(p / size);
      const sample = stockRoughness?.data
        ? stockRoughness.data[
            (Math.floor((y / size) * stockRoughness.height) *
              stockRoughness.width +
              Math.floor((x / size) * stockRoughness.width)) *
              4 +
              1
          ] / 255
        : 1;
      const r = Math.round(
          (material.roughness * sample * (1 - uv[p]) + 0.07 * uv[p]) * 255,
        ),
        c = Math.round(uv[p] * 255);
      roughness.set([r, r, r, 255], p * 4);
      coat.set([c, c, c, 255], p * 4);
    }
    material.roughnessMap = texture(roughness, "Spot UV gloss mask");
    material.roughness = 1;
    material.clearcoatMap = texture(coat, "Spot UV clear varnish");
    material.clearcoat = 1;
    material.clearcoatRoughness = 0.07;
  }
  material.needsUpdate = true;
  return previousNormalMap;
}
