import * as THREE from "three";

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
export function prepareVinylModelExport(model: THREE.Group) {
  const exported = model.clone(true);

  const textureCache = new Map<THREE.Texture, THREE.Texture>();
  const materialCache = new Map<THREE.Material, THREE.Material>();

  const convert = (
    texture: THREE.Texture | null | undefined,
  ): THREE.Texture | null => {
    if (!texture) return null;

    const cached = textureCache.get(texture);
    if (cached) return cached;

    const converted = convertDataTexture(texture);
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
        material.map = convert(material.map);
        material.normalMap = convert(material.normalMap);
        material.roughnessMap = convert(material.roughnessMap);
        material.metalnessMap = convert(material.metalnessMap);
        material.aoMap = convert(material.aoMap);
        material.emissiveMap = convert(material.emissiveMap);
        material.alphaMap = convert(material.alphaMap);

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
