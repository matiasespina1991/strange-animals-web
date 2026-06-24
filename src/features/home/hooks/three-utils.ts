import * as THREE from 'three';

export function getViewportSizeAtZ(
  camera: THREE.PerspectiveCamera,
  targetZ: number,
) {
  const distanceToPlane = camera.position.z - targetZ;
  const height =
    2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distanceToPlane;

  return {
    width: height * camera.aspect,
    height,
  };
}

export function getWorldWidthFromPixels(
  camera: THREE.PerspectiveCamera,
  pixelWidth: number,
) {
  const viewport = getViewportSizeAtZ(camera, 0);

  return (pixelWidth / window.innerWidth) * viewport.width;
}

export function getWorldPositionFromPointerAtZ(
  camera: THREE.PerspectiveCamera,
  event: PointerEvent | MouseEvent | {clientX: number; clientY: number},
  targetZ: number,
) {
  const viewportSize = getViewportSizeAtZ(camera, targetZ);

  return new THREE.Vector2(
    (event.clientX / window.innerWidth - 0.5) * viewportSize.width,
    (0.5 - event.clientY / window.innerHeight) * viewportSize.height,
  );
}

export function getScreenPositionFromWorld(
  camera: THREE.PerspectiveCamera,
  worldPosition: THREE.Vector3,
  targetZ: number,
) {
  const viewportSize = getViewportSizeAtZ(camera, targetZ);

  return {
    x: (worldPosition.x / viewportSize.width + 0.5) * window.innerWidth,
    y: (0.5 - worldPosition.y / viewportSize.height) * window.innerHeight,
  };
}

export function getTextureAlphaBounds(image: HTMLImageElement) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', {willReadFrequently: true});

  if (!context) {
    return null;
  }

  canvas.width = image.width;
  canvas.height = image.height;
  context.drawImage(image, 0, 0);

  const {data} = context.getImageData(0, 0, image.width, image.height);
  let minX = image.width;
  let minY = image.height;
  let maxX = 0;
  let maxY = 0;
  let hasVisiblePixels = false;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const alpha = data[(y * image.width + x) * 4 + 3];

      if (alpha <= 16) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      hasVisiblePixels = true;
    }
  }

  if (!hasVisiblePixels) {
    return null;
  }

  return {
    left: minX / image.width - 0.5,
    right: (maxX + 1) / image.width - 0.5,
    top: 0.5 - minY / image.height,
    bottom: 0.5 - (maxY + 1) / image.height,
  };
}
