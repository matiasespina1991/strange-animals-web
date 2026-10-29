import * as THREE from "three";

/** Linear alpha coverage: no paper color or partial-metal shader at the edge. */
export function foilCoveragePixels(mask: Uint8ClampedArray) {
  const pixels = new Uint8ClampedArray(mask.length);
  for (let i = 0; i < mask.length; i += 4) {
    const coverage = Math.round(mask[i] * mask[i + 3] / 255);
    // Constant RGB even outside the silhouette avoids white/dark matte fringes.
    pixels[i] = pixels[i + 1] = pixels[i + 2] = 255;
    pixels[i + 3] = coverage;
  }
  return pixels;
}

export function applyFoilMask(material: THREE.MeshPhysicalMaterial, image: HTMLImageElement, flip = false) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 2048;
  const context = canvas.getContext("2d", {willReadFrequently: true});
  if (!context) throw Error("Canvas unavailable for foil material.");
  if (flip) { context.translate(canvas.width, 0); context.scale(-1, 1); }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const data = context.getImageData(0, 0, canvas.width, canvas.height);
  data.data.set(foilCoveragePixels(data.data));
  context.putImageData(data, 0, 0);
  // glTF carries base-color alpha, not Three's standalone alphaMap. A white
  // RGBA map preserves the same coverage in preview AND exported/shared GLBs.
  const silhouette = new THREE.CanvasTexture(canvas);
  silhouette.name = "Foil silhouette alpha";
  silhouette.colorSpace = THREE.SRGBColorSpace;
  material.map = silhouette;
  material.color.set("#d6d9df");
  material.metalness = 1;
  material.roughness = 0.035;
  material.transparent = true;
  material.depthWrite = false;
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = -1;
  material.envMapIntensity = 1.4;
  material.needsUpdate = true;
}
