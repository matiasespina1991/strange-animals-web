import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// Only one offscreen renderer/download at a time, even with many visible rows.
let queue: Promise<unknown> = Promise.resolve();
const thumbnails = new Map<string, Promise<string>>();

async function renderThumbnail(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), cache: "no-cache" });
  if (!response.ok) throw Error("Could not load the model thumbnail.");
  const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), "");
  let renderer: THREE.WebGLRenderer | undefined;
  let environment: THREE.WebGLRenderTarget | undefined;
  try {
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    if (bounds.isEmpty()) throw Error("The model has no visible geometry.");
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    model.position.sub(center);
    const scene = new THREE.Scene();
    scene.add(model);
    scene.add(new THREE.AmbientLight(0xffffff, 1.8));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-3, 4, 6);
    scene.add(key);
    const extent = Math.max(size.x, size.y, size.z, 0.001) * 0.62;
    const camera = new THREE.OrthographicCamera(-extent, extent, extent, -extent, extent * 0.01, extent * 20);
    camera.position.set(extent * 0.8, extent * 0.4, extent * 4);
    camera.lookAt(0, 0, 0);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(256, 256);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    let reflective = false;
    model.traverse(object => {
      if (object instanceof THREE.Mesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material.metalness > 0 || material.metalnessMap || material.clearcoat >= 0.1) reflective = true;
      }
    });
    if (reflective) {
      const studio = new RoomEnvironment();
      const pmrem = new THREE.PMREMGenerator(renderer);
      environment = pmrem.fromScene(studio);
      scene.environment = environment.texture;
      studio.dispose(); pmrem.dispose();
    }
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL("image/png");
  } finally {
    // Release GLB textures and GPU buffers; keep only the small captured image.
    const disposed = new Set<{ dispose: () => void }>();
    const dispose = (resource: { dispose: () => void }) => {
      if (!disposed.has(resource)) { disposed.add(resource); resource.dispose(); }
    };
    gltf.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      dispose(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) dispose(value);
        }
        dispose(material);
      }
    });
    renderer?.dispose();
    environment?.dispose();
    renderer?.forceContextLoss();
  }
}

export function sharedModelThumbnail(url: string) {
  let pending = thumbnails.get(url);
  if (!pending) {
    pending = queue.then(() => renderThumbnail(url));
    queue = pending.catch(() => undefined);
    thumbnails.set(url, pending);
    pending.catch(() => thumbnails.delete(url));
    // Bound the session cache instead of retaining every model indefinitely.
    if (thumbnails.size > 80) thumbnails.delete(thumbnails.keys().next().value!);
  }
  return pending;
}
