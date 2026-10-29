import * as THREE from "three";

/** Fine paper grain, independent of artwork RGB; exported as a standard normal map. */
export function createPrintedBoardGrain() {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  let seed = 1541;
  for (let i = 0; i < pixels.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    pixels[i] = 128 + ((seed >>> 24) % 17) - 8;
    pixels[i + 1] = 128 + ((seed >>> 16) % 17) - 8;
    pixels[i + 2] = 255;
    pixels[i + 3] = 255;
  }
  const grain = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  grain.name = "Fine printed paperboard grain";
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(48, 48);
  grain.magFilter = THREE.LinearFilter;
  grain.minFilter = THREE.LinearMipmapLinearFilter;
  grain.generateMipmaps = true;
  grain.needsUpdate = true;
  return grain;
}
