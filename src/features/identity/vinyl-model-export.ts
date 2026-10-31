import * as THREE from "three";

export type VinylExportOptions = {
  deduplicateTextures: boolean;
  solidColors: boolean;
  jpegArtwork: boolean;
  requiredMapsOnly: boolean;
};

/** Disable individual experiments with ?glbBaseline=1 or ?glbDisable=2,4. */
export function readVinylExportOptions(): VinylExportOptions {
  const params = typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
  const disabled = new Set((params?.get("glbDisable") ?? "").split(","));
  const enabled = (id: string) => params?.get("glbBaseline") !== "1" && !disabled.has(id);
  return {
    deduplicateTextures: enabled("2"), solidColors: enabled("3"),
    jpegArtwork: enabled("4"), requiredMapsOnly: enabled("7"),
  };
}

function convertDataTexture(texture: THREE.Texture): THREE.Texture {
  if (!(texture instanceof THREE.DataTexture)) return texture;

  const image = texture.image;
  if (!image?.data || !image.width || !image.height) {
    throw new Error("Invalid DataTexture for GLB export.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is unavailable for GLB texture conversion.");
  }

  const rgba = new Uint8ClampedArray(image.width * image.height * 4);
  const source = image.data;

  for (let i = 0; i < image.width * image.height; i++) {
    const offset = i * 4;
    rgba[offset] = source[offset];
    rgba[offset + 1] = source[offset + 1];
    rgba[offset + 2] = source[offset + 2];
    rgba[offset + 3] = source[offset + 3];
  }

  context.putImageData(new ImageData(rgba, image.width, image.height), 0, 0);

  const converted = new THREE.CanvasTexture(canvas);
  converted.name = texture.name;
  converted.colorSpace = texture.colorSpace;
  converted.wrapS = texture.wrapS;
  converted.wrapT = texture.wrapT;
  converted.magFilter = texture.magFilter;
  converted.minFilter = texture.minFilter;
  converted.flipY = texture.flipY;
  converted.repeat.copy(texture.repeat);
  converted.offset.copy(texture.offset);
  converted.rotation = texture.rotation;
  converted.center.copy(texture.center);
  converted.channel = texture.channel;
  converted.needsUpdate = true;

  return converted;
}

/** One preview unit is 10 cm; glTF/AR uses metres. */
export function prepareVinylModelExport(
  model: THREE.Group,
  options = readVinylExportOptions(),
) {
  const exported = model.clone(true);

  const textureCache = new Map<THREE.Texture, THREE.Texture>();
  const materialCache = new Map<THREE.Material, THREE.Material>();
  const imageCache = new Map<string, { image: HTMLCanvasElement; pixels: Uint8ClampedArray }[]>();

  const inspect = (texture: THREE.Texture) => {
    const canvas = texture.image as HTMLCanvasElement | undefined;
    if (typeof canvas?.getContext !== "function") return undefined;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return undefined;
    return { canvas, pixels: context.getImageData(0, 0, canvas.width, canvas.height).data };
  };

  const convert = (
    texture: THREE.Texture | null | undefined,
  ): THREE.Texture | null => {
    if (!texture) return null;

    const cached = textureCache.get(texture);
    if (cached) return cached;

    // Clone even CanvasTextures: export policy must never mutate the preview.
    const converted = convertDataTexture(texture).clone();
    if (options.deduplicateTextures) {
      const data = inspect(converted);
      if (data) {
        let hash = 2166136261;
        for (const value of data.pixels) hash = Math.imul(hash ^ value, 16777619);
        const key = `${data.canvas.width}:${data.canvas.height}:${hash}`;
        const candidates = imageCache.get(key) ?? [];
        const identical = candidates.find(candidate =>
          candidate.pixels.every((value, index) => value === data.pixels[index]),
        );
        if (identical) converted.image = identical.image;
        else {
          candidates.push({ image: data.canvas, pixels: data.pixels });
          imageCache.set(key, candidates);
        }
      }
    }
    textureCache.set(texture, converted);
    return converted;
  };

  exported.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;

    const cloneMaterial = (original: THREE.Material): THREE.Material => {
      const cached = materialCache.get(original);
      if (cached) return cached;

      const material = original.clone();

      if (material instanceof THREE.MeshStandardMaterial) {
        if (options.requiredMapsOnly) {
          if (material.metalness === 0) material.metalnessMap = null;
          if (material.roughness === 0) material.roughnessMap = null;
          if (material.normalScale.x === 0 && material.normalScale.y === 0)
            material.normalMap = null;
        }
        material.map = convert(material.map);
        material.normalMap = convert(material.normalMap);
        material.roughnessMap = convert(material.roughnessMap);
        material.metalnessMap = convert(material.metalnessMap);
        material.aoMap = convert(material.aoMap);
        material.emissiveMap = convert(material.emissiveMap);
        material.alphaMap = convert(material.alphaMap);

        if (material.map && (options.solidColors || options.jpegArtwork)) {
          const data = inspect(material.map);
          if (data) {
            const p = data.pixels;
            let opaque = true, uniform = true;
            for (let i = 0; i < p.length; i += 4) {
              if (p[i + 3] !== 255) opaque = false;
              if (p[i] !== p[0] || p[i + 1] !== p[1] || p[i + 2] !== p[2]) uniform = false;
            }
            if (opaque && uniform && options.solidColors) {
              const color = new THREE.Color().setRGB(p[0] / 255, p[1] / 255, p[2] / 255,
                material.map.colorSpace === THREE.SRGBColorSpace ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace);
              material.color.multiply(color);
              material.map = null;
            } else if (opaque && options.jpegArtwork) {
              material.map.userData = { ...material.map.userData, mimeType: "image/jpeg" };
            }
          }
        }

        if (material instanceof THREE.MeshPhysicalMaterial) {
          material.clearcoatMap = convert(material.clearcoatMap);
          material.clearcoatNormalMap = convert(material.clearcoatNormalMap);
          material.clearcoatRoughnessMap = convert(
            material.clearcoatRoughnessMap,
          );
          material.sheenColorMap = convert(material.sheenColorMap);
          material.sheenRoughnessMap = convert(material.sheenRoughnessMap);
          material.specularColorMap = convert(material.specularColorMap);
          material.specularIntensityMap = convert(
            material.specularIntensityMap,
          );
          material.transmissionMap = convert(material.transmissionMap);
          material.thicknessMap = convert(material.thicknessMap);
          material.iridescenceMap = convert(material.iridescenceMap);
          material.iridescenceThicknessMap = convert(
            material.iridescenceThicknessMap,
          );
          material.anisotropyMap = convert(material.anisotropyMap);
          if (options.requiredMapsOnly) {
            if (material.clearcoat === 0) {
              material.clearcoatMap = null;
              material.clearcoatNormalMap = null;
              material.clearcoatRoughnessMap = null;
            }
            if (material.sheen === 0) {
              material.sheenColorMap = null;
              material.sheenRoughnessMap = null;
            }
            if (material.transmission === 0) {
              material.transmissionMap = null;
              material.thicknessMap = null;
            }
            if (material.iridescence === 0) {
              material.iridescenceMap = null;
              material.iridescenceThicknessMap = null;
            }
            if (material.anisotropy === 0) material.anisotropyMap = null;
          }
        }

        material.needsUpdate = true;
      }

      materialCache.set(original, material);
      return material;
    };

    object.material = Array.isArray(object.material)
      ? object.material.map(cloneMaterial)
      : cloneMaterial(object.material);
  });

  exported.scale.multiplyScalar(0.1);
  exported.userData = {
    ...exported.userData,
    vinylArtworkScale: 0.1,
  };
  exported.updateMatrixWorld(true);

  return exported;
}
