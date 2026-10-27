import { useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, Share2 } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { accountAuth } from "./account-auth";
import { AccountControl } from "./AccountControl";
import { createModelShare } from "../ar-model/model-share-repository";
import type { LabelSide } from "./design-configurator-model";
import { createSleeveShell } from "./sleeve-shell";
import { createCookieCoreGeometry } from "./cookie-core-geometry";

type Properties = {
  labelCapture: string;
  labelCaptureBack: string;
  side: LabelSide;
  sleeveColor: string;
  labelColor: string;
  sleeveImage?: string;
  sleeveCaptureFront?: string;
  sleeveCaptureBack?: string;
  sleeveZoom: number;
  sleeveImageOffsetX: number;
  sleeveImageOffsetY: number;
  labelDiameterMm: number;
  labelHoleMm: number;
};

const SLEEVE_SIZE_MM = 315;
const WORLD_SCALE = 1 / 100;
const previewBackgroundUrl = "/media/images/pexels-photo-6131931.avif";
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
  labelColor,
  sleeveImage,
  sleeveCaptureFront,
  sleeveCaptureBack,
  sleeveZoom,
  sleeveImageOffsetX,
  sleeveImageOffsetY,
  labelDiameterMm,
  labelHoleMm,
}: Properties) {
  const host = useRef<HTMLDivElement>(null);
  const modelExporterReference = useRef<() => Promise<Blob>>(() =>
    Promise.reject(Error("The 3D preview is not ready yet.")),
  );
  const modelReference = useRef<THREE.Group | null>(null);
  const labelImagesReference = useRef<HTMLImageElement[]>([]);
  const sleeveImageReference = useRef<HTMLImageElement | null>(null);
  const sleeveCaptureImagesReference = useRef<HTMLImageElement[]>([]);
  const cameraReference = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsReference = useRef<OrbitControls | null>(null);
  const [error, setError] = useState("");
  const [zoomPercent, setZoomPercent] = useState(100);
  const [sharing, setSharing] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const pendingShareWindowReference = useRef<Window | null>(null);
  const [shareError, setShareError] = useState("");

  useEffect(() => {
    const container = host.current;
    if (!container) return;

    let active = true;
    let sleeveImageElement: HTMLImageElement | null = null;
    const sleeveCaptureImages: HTMLImageElement[] = [];
    const labelImages: HTMLImageElement[] = [];
    labelImagesReference.current = labelImages;
    const scene = new THREE.Scene();
    const model = new THREE.Group();
    model.name = "Strange Animals sleeve and label";
    scene.add(model);
    modelReference.current = model;
    scene.background = null;
    const previousContainerBackground = container.style.background;
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.copy(INITIAL_CAMERA_POSITION);
    cameraReference.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setError("WebGL is not available in this browser.");
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    container.style.background = `#e5e7e1 url("${previewBackgroundUrl}") center / cover no-repeat`;
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
          (INITIAL_CAMERA_DISTANCE /
            camera.position.distanceTo(controls.target)) *
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

    scene.add(new THREE.AmbientLight(0xff_ff_ff, 0.7));
    scene.add(new THREE.HemisphereLight(0xff_ff_ff, 0x34_33_2f, 1.5));
    const keyLight = new THREE.DirectionalLight(0xff_ff_ff, 0.3);
    keyLight.position.set(-3, 5, 6);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xbc_c9_d0, 0.25);
    fillLight.position.set(4, 1, 3);
    scene.add(fillLight);

    const sleeveSize = SLEEVE_SIZE_MM * WORLD_SCALE;
    const baseSleeveDepth = 0.026;
    const cookieRecessDepth = 0.007;
    const cookieThicknessScale = 0.8;
    const cookieDepth =
      (baseSleeveDepth - cookieRecessDepth * 2) * cookieThicknessScale;
    const sleeveDepth = cookieDepth + cookieRecessDepth * 2;
    const cookieBevelSize = 0.006;
    const cookieBevelThickness = 0.002;
    const labelRadius = (labelDiameterMm / 2) * WORLD_SCALE;
    const holeRadius = (labelHoleMm / 2) * WORLD_SCALE;
    const cookieRecessInnerRadius = labelRadius - cookieBevelSize - 0.0005;
    const cookieRecessLipWidth = cookieRecessDepth;
    const cookieRecessOpeningRadius =
      cookieRecessInnerRadius + cookieRecessLipWidth;

    const createSleeveTexture = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 1024;
      const context = canvas.getContext("2d");
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return { canvas, context, texture };
    };
    const sleeveFront = createSleeveTexture();
    const sleeveBack = createSleeveTexture();
    sleeveCaptureImagesReference.current = sleeveCaptureImages;

    const drawSleeveFace = (
      target: ReturnType<typeof createSleeveTexture>,
      capture: HTMLImageElement | null,
      flipCapture = false,
    ) => {
      const { canvas, context, texture } = target;
      if (!context) return;
      const size = canvas.width;
      context.clearRect(0, 0, size, size);
      if (capture?.complete && capture.naturalWidth) {
        context.save();
        if (flipCapture) {
          context.translate(size, 0);
          context.scale(-1, 1);
        }
        context.drawImage(capture, 0, 0, size, size);
        context.restore();
        texture.needsUpdate = true;
        return;
      }
      context.fillStyle = sleeveColor;
      context.fillRect(0, 0, size, size);
      if (sleeveImageElement?.complete && sleeveImageElement.naturalWidth) {
        const coverScale = Math.max(
          size / sleeveImageElement.naturalWidth,
          size / sleeveImageElement.naturalHeight,
        );
        const imageWidth =
          sleeveImageElement.naturalWidth * coverScale * sleeveZoom;
        const imageHeight =
          sleeveImageElement.naturalHeight * coverScale * sleeveZoom;
        context.drawImage(
          sleeveImageElement,
          (size - imageWidth) / 2 + (sleeveImageOffsetX * size) / 600,
          (size - imageHeight) / 2 + (sleeveImageOffsetY * size) / 600,
          imageWidth,
          imageHeight,
        );
      }
      texture.needsUpdate = true;
    };

    let sleeveCaptureFrontElement: HTMLImageElement | null = null;
    let sleeveCaptureBackElement: HTMLImageElement | null = null;
    const drawSleeve = () => {
      drawSleeveFace(sleeveFront, sleeveCaptureFrontElement);
      drawSleeveFace(sleeveBack, sleeveCaptureBackElement, true);
    };
    drawSleeve();
    model.add(createSleeveShell(sleeveSize, sleeveDepth, cookieRecessOpeningRadius, sleeveFront.texture, sleeveBack.texture, sleeveColor));
    const cookieGeometry = createCookieCoreGeometry(labelRadius, holeRadius, cookieDepth, cookieBevelSize, cookieBevelThickness);
    const cookie = new THREE.Mesh(cookieGeometry, [
      new THREE.MeshPhysicalMaterial({
        color: labelColor,
        roughness: 0.84,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
      new THREE.MeshPhysicalMaterial({
        color: labelColor,
        roughness: 0.84,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
      new THREE.MeshPhysicalMaterial({
        color: 0x12_12_12,
        roughness: 0.84,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    ]);
    model.add(cookie);

    if (sleeveImage) {
      sleeveImageElement = new Image();
      sleeveImageReference.current = sleeveImageElement;
      sleeveImageElement.addEventListener("load", drawSleeve);
      sleeveImageElement.src = sleeveImage;
    }
    if (sleeveCaptureFront) {
      sleeveCaptureFrontElement = new Image();
      sleeveCaptureImages.push(sleeveCaptureFrontElement);
      sleeveCaptureFrontElement.addEventListener("load", drawSleeve);
      sleeveCaptureFrontElement.src = sleeveCaptureFront;
    }
    if (sleeveCaptureBack) {
      sleeveCaptureBackElement = new Image();
      sleeveCaptureImages.push(sleeveCaptureBackElement);
      sleeveCaptureBackElement.addEventListener("load", drawSleeve);
      sleeveCaptureBackElement.src = sleeveCaptureBack;
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
        const center = labelCanvas.width / 2;
        const focalOffset = center * 0.005;
        const innerShadow = context.createRadialGradient(
          center + focalOffset,
          center + focalOffset,
          center * 0.95,
          center + focalOffset,
          center + focalOffset,
          center,
        );
        innerShadow.addColorStop(0, "rgba(22, 26, 20, 0)");
        innerShadow.addColorStop(0.4, "rgba(22, 26, 20, 0.015)");
        innerShadow.addColorStop(0.8, "rgba(22, 26, 20, 0.065)");
        innerShadow.addColorStop(1, "rgba(22, 26, 20, 0.21)");
        context.globalCompositeOperation = "source-atop";
        context.fillStyle = innerShadow;
        context.fillRect(0, 0, labelCanvas.width, labelCanvas.height);
        context.globalCompositeOperation = "source-over";
        context.globalCompositeOperation = "destination-out";
        context.beginPath();
        context.arc(
          center,
          center,
          (holeRadius / labelRadius) * center,
          0,
          Math.PI * 2,
        );
        context.fill();
        context.globalCompositeOperation = "source-over";
        const labelTexture = new THREE.CanvasTexture(labelCanvas);
        labelTexture.colorSpace = THREE.SRGBColorSpace;
        labelTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        const label = new THREE.Mesh(
          new THREE.RingGeometry(holeRadius, labelRadius - cookieBevelSize, 128),
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
    addLabelFace(labelCapture, cookieDepth / 2 + 0.001);
    addLabelFace(labelCaptureBack, -cookieDepth / 2 - 0.001, true);

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
      sleeveCaptureImagesReference.current = [];
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
      sleeveCaptureImages.forEach((image) => image.removeAttribute("src"));
      labelImages.forEach((image) => image.removeAttribute("src"));
      renderer.dispose();
      renderer.domElement.remove();
      container.style.background = previousContainerBackground;
    };
  }, [
    labelCapture,
    labelCaptureBack,
    labelDiameterMm,
    sleeveColor,
    labelColor,
    labelHoleMm,
    sleeveImage,
    sleeveCaptureFront,
    sleeveCaptureBack,
    sleeveZoom,
    sleeveImageOffsetX,
    sleeveImageOffsetY,
  ]);

  const exportModel = async () => {
    const model = modelReference.current;
    if (!model) throw Error("The 3D preview is not ready yet.");
    const images = [
      ...labelImagesReference.current,
      ...(sleeveImageReference.current ? [sleeveImageReference.current] : []),
      ...sleeveCaptureImagesReference.current,
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
  modelExporterReference.current = exportModel;
  const shareModel = async () => {
    if (sharing) return;
    const previewWindow =
      pendingShareWindowReference.current ??
      window.open("about:blank", "_blank");
    if (!previewWindow) {
      setShareError("Allow pop-ups to open the shared 3D model in a new tab.");
      return;
    }
    if (!accountAuth.currentUser) {
      setShareError("");
      pendingShareWindowReference.current = previewWindow;
      setSignInOpen(true);
      return;
    }
    pendingShareWindowReference.current = null;
    previewWindow.opener = null;
    setSharing(true);
    setShareError("");
    setUploadProgress(0);
    if (import.meta.env.DEV) console.info("[Sleeve3DPreview/share] started");
    try {
      const modelBlob = await exportModel();
      if (import.meta.env.DEV) {
        console.info("[Sleeve3DPreview/share] model-exported", {
          bytes: modelBlob.size,
        });
      }
      const modelFile = new File([modelBlob], "strange-animals-sleeve.glb", {
        type: "model/gltf-binary",
      });
      const shared = await createModelShare(
        modelFile,
        "3D sleeve + label",
        setUploadProgress,
      );
      const url = `${window.location.origin}/${shared.id}`;
      if (import.meta.env.DEV) {
        console.info("[Sleeve3DPreview/share] public-link-created", {
          id: shared.id,
          url,
        });
      }
      if (!previewWindow.closed) previewWindow.location.replace(url);
    } catch (shareFailure) {
      if (!previewWindow.closed) previewWindow.close();
      pendingShareWindowReference.current = null;
      if (import.meta.env.DEV) {
        console.error("[Sleeve3DPreview/share] failed", {
          error: shareFailure,
        });
      }
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
          onClose={() => {
            setSignInOpen(false);
            pendingShareWindowReference.current?.close();
            pendingShareWindowReference.current = null;
          }}
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
    </div>
  );
}
