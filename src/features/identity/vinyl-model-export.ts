import * as THREE from "three";

/** One preview unit is 10 cm; glTF/AR uses metres. */
export function prepareVinylModelExport(model: THREE.Group) {
  const exported = model.clone(true);
  exported.scale.multiplyScalar(0.1);
  exported.userData = {...exported.userData, vinylArtworkScale: 0.1};
  exported.updateMatrixWorld(true);
  return exported;
}
