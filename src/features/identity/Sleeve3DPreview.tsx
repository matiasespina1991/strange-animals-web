import { useEffect, useRef, useState } from "react";
import { Check, Copy, Minus, Plus, RotateCcw, Share2 } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { accountAuth } from "./account-auth";
import { AccountControl } from "./AccountControl";
import { createModelShare } from "../ar-model/model-share-repository";
import type { LabelSide } from "./design-configurator-model";

type Properties = {
  labelCapture: string;
  labelCaptureBack: string;
  side: LabelSide;
  sleeveColor: string;
  sleeveImage?: string;
  sleeveZoom: number;
  labelDiameterMm: number;
};

const SLEEVE_SIZE_MM = 315;
const WORLD_SCALE = 1 / 100;
const INITIAL_CAMERA_POSITION = new THREE.Vector3(3.7, 2.8, 5.6);
const INITIAL_CAMERA_DISTANCE = INITIAL_CAMERA_POSITION.length();
const PREVIOUS_MIN_CAMERA_DISTANCE = 1.5;
const MAX_ZOOM_PERCENT = Math.round(
  (INITIAL_CAMERA_DISTANCE / PREVIOUS_MIN_CAMERA_DISTANCE) * 4 * 100,
);

export function Sleeve3DPreview({
  labelCapture,
  labelCaptureBack,
  side,
  sleeveColor,
  sleeveImage,
  sleeveZoom,
  labelDiameterMm,
}: Properties) {
  const host = useRef<HTMLDivElement>(null);
  const modelReference = useRef<THREE.Group | null>(null);
  const labelImagesReference = useRef<HTMLImageElement[]>([]);
  const sleeveImageReference = useRef<HTMLImageElement | null>(null);
  const cameraReference = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsReference = useRef<OrbitControls | null>(null);
  const [error, setError] = useState("");
  const [zoomPercent, setZoomPercent] = useState(100);
  const [sharing, setSharing] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [shareError, setShareError] = useState("");
  const [sharedUrl, setSharedUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const container = host.current;
    if (!container) return;

    let active = true;
    let sleeveImageElement: HTMLImageElement | null = null;
    const labelImages: HTMLImageElement[] = [];
    labelImagesReference.current = labelImages;
    const scene = new THREE.Scene();
    const model = new THREE.Group();
    model.name = "Strange Animals sleeve and label";
    scene.add(model);
    modelReference.current = model;
    scene.background = new THREE.Color("#e5e7e1");
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.copy(INITIAL_CAMERA_POSITION);
    cameraReference.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setError("WebGL is not available in this browser.");
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.append(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = INITIAL_CAMERA_DISTANCE / (MAX_ZOOM_PERCENT / 100);
    controls.maxDistance = 10;
    controls.target.set(0, 0, 0);
    let lastZoomPercent = 100;
    const updateZoomPercent = () => {
      const nextZoomPercent = Math.min(
        MAX_ZOOM_PERCENT,
        Math.round(
          (INITIAL_CAMERA_DISTANCE / camera.position.distanceTo(controls.target)) *
            100,
        ),
      );
      if (nextZoomPercent !== lastZoomPercent) {
        lastZoomPercent = nextZoomPercent;
        setZoomPercent(nextZoomPercent);
      }
    };
    controls.addEventListener("change", updateZoomPercent);
    controlsReference.current = controls;

    scene.add(new THREE.HemisphereLight(0xff_ff_ff, 0x34_33_2f, 1.1));
    const keyLight = new THREE.DirectionalLight(0xff_ff_ff, 1.7);
    keyLight.position.set(-3, 5, 6);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xbc_c9_d0, 0.55);
    fillLight.position.set(4, 1, 3);
    scene.add(fillLight);
    const sleeveHighlight = new THREE.DirectionalLight(0xff_ff_ff, 0.28);
    sleeveHighlight.position.set(-3.7, -2.8, 6);
    scene.add(sleeveHighlight);
    const sleeveBackHighlight = new THREE.DirectionalLight(0xff_ff_ff, 0.28);
    sleeveBackHighlight.position.set(-3.7, -2.8, -6);
    scene.add(sleeveBackHighlight);

    const sleeveSize = SLEEVE_SIZE_MM * WORLD_SCALE;
    const sleeveDepth = 0.04;
    const labelRadius = (labelDiameterMm / 2) * WORLD_SCALE;
    const sleeveBacking = new THREE.Mesh(
      new THREE.BoxGeometry(sleeveSize, sleeveSize, sleeveDepth),
      new THREE.MeshPhysicalMaterial({
        color: sleeveColor,
        roughness: 0.32,
        metalness: 0,
        clearcoat: 0.19,
        clearcoatRoughness: 0.22,
      }),
    );
    sleeveBacking.position.z = 0;
    model.add(sleeveBacking);

    const sleeveCanvas = document.createElement("canvas");
    sleeveCanvas.width = 1024;
    sleeveCanvas.height = 1024;
    const sleeveContext = sleeveCanvas.getContext("2d");
    const sleeveTexture = new THREE.CanvasTexture(sleeveCanvas);
    sleeveTexture.colorSpace = THREE.SRGBColorSpace;

    const drawSleeve = () => {
      if (!sleeveContext) return;
      const size = sleeveCanvas.width;
      sleeveContext.clearRect(0, 0, size, size);
      sleeveContext.fillStyle = sleeveColor;
      sleeveContext.fillRect(0, 0, size, size);
      if (sleeveImageElement?.complete && sleeveImageElement.naturalWidth) {
        const coverScale = Math.max(
          size / sleeveImageElement.naturalWidth,
          size / sleeveImageElement.naturalHeight,
        );
        const imageWidth =
          sleeveImageElement.naturalWidth * coverScale * sleeveZoom;
        const imageHeight =
          sleeveImageElement.naturalHeight * coverScale * sleeveZoom;
        sleeveContext.drawImage(
          sleeveImageElement,
          (size - imageWidth) / 2,
          (size - imageHeight) / 2,
          imageWidth,
          imageHeight,
        );
      }

      sleeveTexture.needsUpdate = true;
    };

    drawSleeve();
    const sleeveFace = new THREE.Mesh(
      new THREE.PlaneGeometry(sleeveSize, sleeveSize),
      new THREE.MeshPhysicalMaterial({
        map: sleeveTexture,
        roughness: 0.32,
        metalness: 0,
        clearcoat: 0.19,
        clearcoatRoughness: 0.22,
        side: THREE.DoubleSide,
      }),
    );
    sleeveFace.position.z = sleeveDepth / 2 + 0.001;
    model.add(sleeveFace);
    const sleeveBack = new THREE.Mesh(
      new THREE.PlaneGeometry(sleeveSize, sleeveSize),
      new THREE.MeshPhysicalMaterial({
        map: sleeveTexture,
        roughness: 0.32,
        metalness: 0,
        clearcoat: 0.19,
        clearcoatRoughness: 0.22,
        side: THREE.DoubleSide,
      }),
    );
    sleeveBack.position.z = -sleeveDepth / 2 - 0.001;
    sleeveBack.rotation.y = Math.PI;
    model.add(sleeveBack);

    if (sleeveImage) {
      sleeveImageElement = new Image();
      sleeveImageReference.current = sleeveImageElement;
      sleeveImageElement.addEventListener("load", drawSleeve);
      sleeveImageElement.src = sleeveImage;
    }

    const addLabelFace = (capture: string, z: number, back = false) => {
      const labelImage = new Image();
      labelImages.push(labelImage);
      labelImage.addEventListener("load", () => {
        if (!active) return;
        const labelCanvas = document.createElement("canvas");
        labelCanvas.width = 1024;
        labelCanvas.height = 1024;
        const context = labelCanvas.getContext("2d");
        if (!context) return;
        context.drawImage(labelImage, 0, 0, 1024, 1024);
        const labelTexture = new THREE.CanvasTexture(labelCanvas);
        labelTexture.colorSpace = THREE.SRGBColorSpace;
        labelTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        const label = new THREE.Mesh(
          new THREE.CircleGeometry(labelRadius, 128),
          new THREE.MeshPhysicalMaterial({
            map: labelTexture,
            roughness: 0.32,
            metalness: 0,
            clearcoat: 0.19,
            clearcoatRoughness: 0.22,
            transparent: true,
            side: THREE.DoubleSide,
          }),
        );
        label.position.z = z;
        if (back) label.rotation.y = Math.PI;
        model.add(label);
      });
      labelImage.addEventListener("error", () => {
        if (active) setError("The captured label artwork could not be loaded.");
      });
      labelImage.src = capture;
    };
    addLabelFace(labelCapture, sleeveDepth / 2 + 0.004);
    addLabelFace(labelCaptureBack, -sleeveDepth / 2 - 0.004, true);

    const resize = () => {
      if (!container.clientWidth || !container.clientHeight) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });

    return () => {
      active = false;
      observer.disconnect();
      renderer.setAnimationLoop(null);
      controls.removeEventListener("change", updateZoomPercent);
      controls.dispose();
      controlsReference.current = null;
      cameraReference.current = null;
      modelReference.current = null;
      labelImagesReference.current = [];
      sleeveImageReference.current = null;
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        for (const material of materials) {
          material.map?.dispose();
          material.dispose();
        }
      });
      sleeveImageElement?.removeAttribute("src");
      labelImages.forEach((image) => image.removeAttribute("src"));
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [
    labelCapture,
    labelCaptureBack,
    labelDiameterMm,
    sleeveColor,
    sleeveImage,
    sleeveZoom,
  ]);

  const exportModel = async () => {
    const model = modelReference.current;
    if (!model) throw Error("The 3D preview is not ready yet.");
    const images = [
      ...labelImagesReference.current,
      ...(sleeveImageReference.current ? [sleeveImageReference.current] : []),
    ];
    await Promise.all(
      images.map(
        (image) =>
          new Promise<void>((resolve, reject) => {
            if (image.complete) {
              if (image.naturalWidth) resolve();
              else reject(Error("A preview texture could not be loaded."));
              return;
            }
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener(
              "error",
              () => reject(Error("A preview texture could not be loaded.")),
              { once: true },
            );
          }),
      ),
    );
    return new Promise<Blob>((resolve, reject) => {
      new GLTFExporter().parse(
        model,
        (result) => {
          if (!(result instanceof ArrayBuffer)) {
            reject(Error("The 3D model could not be exported."));
            return;
          }
          resolve(new Blob([result], { type: "model/gltf-binary" }));
        },
        reject,
        { binary: true },
      );
    });
  };

  const shareModel = async () => {
    if (sharing) return;
    if (!accountAuth.currentUser) {
      setShareError("");
      setSignInOpen(true);
      return;
    }
    setSharing(true);
    setShareError("");
    setUploadProgress(0);
    try {
      const modelBlob = await exportModel();
      const modelFile = new File([modelBlob], "strange-animals-sleeve.glb", {
        type: "model/gltf-binary",
      });
      const shared = await createModelShare(
        modelFile,
        "3D sleeve + label",
        setUploadProgress,
      );
      setSharedUrl(`${window.location.origin}/${shared.id}`);
    } catch (shareFailure) {
      const code =
        typeof shareFailure === "object" &&
        shareFailure !== null &&
        "code" in shareFailure
          ? shareFailure.code
          : "";
      setShareError(
        code === "storage/unauthorized"
          ? "Firebase Storage rules must be published to allow model sharing."
          : code === "permission-denied"
            ? "Firestore sharing rules must be published to allow model sharing."
            : shareFailure instanceof Error
              ? shareFailure.message
              : "The model could not be shared.",
      );
    } finally {
      setSharing(false);
    }
  };

  const copyShareLink = async () => {
    if (!sharedUrl) return;
    try {
      await navigator.clipboard.writeText(sharedUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setShareError("Copy was blocked. Select the link and copy it manually.");
    }
  };

  const resetView = () => {
    const camera = cameraReference.current;
    const controls = controlsReference.current;
    if (!camera || !controls) return;
    camera.position.copy(INITIAL_CAMERA_POSITION);
    controls.target.set(0, 0, 0);
    controls.update();
  };

  const changeZoom = (factor: number) => {
    const camera = cameraReference.current;
    const controls = controlsReference.current;
    if (!camera || !controls) return;
    const offset = camera.position
      .clone()
      .sub(controls.target)
      .multiplyScalar(factor);
    camera.position.copy(controls.target).add(offset);
    controls.update();
  };

  return (
    <div className="dc-3d-preview">
      <div
        className="dc-3d-scene"
        ref={host}
        aria-label="Interactive 3D sleeve with captured front and back labels"
      >
        {error && (
          <p className="dc-3d-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="dc-3d-controls">
        <span>3D SLEEVE · FRONT A / BACK B · STARTING SIDE {side}</span>
        <div>
          <button
            className="dc-3d-share-button"
            aria-label={sharing ? "Sharing 3D model" : "Share 3D model"}
            title={
              sharing
                ? `Uploading ${Math.round(uploadProgress * 100)}%`
                : "Share 3D model"
            }
            disabled={sharing}
            onClick={() => void shareModel()}
          >
            {sharing ? (
              <span>{Math.round(uploadProgress * 100)}%</span>
            ) : (
              <Share2 size={15} />
            )}
          </button>
          {sharedUrl && (
            <button
              aria-label={copied ? "Share link copied" : "Copy share link"}
              title={copied ? "Copied" : "Copy share link"}
              onClick={() => void copyShareLink()}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          )}
          <output className="dc-3d-zoom-level" aria-label="3D zoom level">
            {zoomPercent}%
          </output>
          <button
            aria-label="Zoom out 3D preview"
            title="Zoom out"
            onClick={() => {
              changeZoom(1.2);
            }}
          >
            <Minus size={16} />
          </button>
          <button
            aria-label="Zoom in 3D preview"
            title="Zoom in"
            onClick={() => {
              changeZoom(0.83);
            }}
          >
            <Plus size={16} />
          </button>
          <button
            aria-label="Reset 3D view"
            title="Reset view"
            onClick={resetView}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
      {signInOpen && (
        <AccountControl
          autoOpen
          hideTrigger
          signInPrompt="Sign in with Google to share this 3D model."
          onClose={() => setSignInOpen(false)}
          onSignedIn={() => {
            setSignInOpen(false);
            void shareModel();
          }}
        />
      )}
      {shareError && (
        <p className="dc-3d-share-error" role="alert">
          {shareError}
        </p>
      )}
      {sharedUrl && (
        <label className="dc-3d-share-result">
          <span>Public 3D model link</span>
          <input aria-label="Public 3D model link" readOnly value={sharedUrl} />
        </label>
      )}
    </div>
  );
}
