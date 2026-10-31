import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, RotateCcw, Share2 } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { applyFoilMask } from "./foil-material";
import {
  createCookiePaperTexture,
  createCookiePaperRoughnessTexture,
} from "./cookie-paper-texture";
import {
  applyPrintRelief,
  type ReliefMasks,
  type SurfaceReliefMasks,
} from "./print-relief-material";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { accountAuth } from "./account-auth";
import { AccountControl } from "./AccountControl";
import { createModelShare } from "../ar-model/model-share-repository";
import type { LabelSide } from "./design-configurator-model";
import { createSleeveShell } from "./sleeve-shell";
import { createCookieCoreGeometry } from "./cookie-core-geometry";
import { applyPressingRelief, type PressingPreset } from "./pressing-rings";
import { PressingPresetPicker } from "./PressingPresetPicker";
import { prepareVinylModelExport } from "./vinyl-model-export";
import { vinylWebpPlugin } from "./vinyl-webp-exporter";
import { loadClassicSleevePaper } from "./sleeve-pbr-paper";

type Properties = {
  modelShareId: string;
  modelTitle: string;
  pressingPreset: PressingPreset;
  onPressingPresetChange: (preset: PressingPreset) => void;
  pressingMarks: boolean;
  onPressingMarksChange: (enabled: boolean) => void;
  onSleeveMaterialChange: (
    value: "matte" | "printed-board" | "printed-board-glossy",
  ) => void;
  headingTarget: HTMLElement | null;
  labelCapture: string;
  labelCaptureBack: string;
  side: LabelSide;
  sleeveColor: string;
  sleeveMaterial?: "matte" | "printed-board" | "printed-board-glossy";
  labelColor: string;
  sleeveImage?: string;
  sleeveCaptureFront?: string;
  sleeveCaptureBack?: string;
  sleeveZoom: number;
  sleeveImageOffsetX: number;
  sleeveImageOffsetY: number;
  labelDiameterMm: number;
  labelHoleMm: number;
  windows?: { A: boolean; B: boolean };
  foilMasks?: { A: string; B: string; sleeveA: string; sleeveB: string };
  reliefMasks?: SurfaceReliefMasks;
};

const SLEEVE_SIZE_MM = 315;
const VINYL_DIAMETER_MM = 304.8;
const WORLD_SCALE = 1 / 100;
const previewBackgroundUrl = "/media/images/pexels-photo-6131931.avif";
const INITIAL_CAMERA_POSITION = new THREE.Vector3(1, 0.35, 5.55);
const INITIAL_CAMERA_DISTANCE = new THREE.Vector3(3.7, 2.8, 5.6).length();
const INITIAL_ZOOM_PERCENT = Math.round(
  (INITIAL_CAMERA_DISTANCE / INITIAL_CAMERA_POSITION.length()) * 100,
);
const MAX_ZOOM_PERCENT = 4000;

export function Sleeve3DPreview({
  modelShareId,
  modelTitle,
  pressingPreset,
  onPressingPresetChange,
  pressingMarks,
  onPressingMarksChange,
  onSleeveMaterialChange,
  headingTarget,
  labelCapture,
  labelCaptureBack,
  side,
  sleeveColor,
  sleeveMaterial = "printed-board",
  labelColor,
  sleeveImage,
  sleeveCaptureFront,
  sleeveCaptureBack,
  sleeveZoom,
  sleeveImageOffsetX,
  sleeveImageOffsetY,
  labelDiameterMm,
  labelHoleMm,
  windows,
  foilMasks,
  reliefMasks,
}: Properties) {
  const host = useRef<HTMLDivElement>(null);
  const captureSharePreview = useRef<(() => Promise<Blob>) | null>(null);
  const modelExporterReference = useRef<() => Promise<Blob>>(() =>
    Promise.reject(Error("The 3D preview is not ready yet.")),
  );
  const modelReference = useRef<THREE.Group | null>(null);
  const labelImagesReference = useRef<HTMLImageElement[]>([]);
  const sleeveImageReference = useRef<HTMLImageElement | null>(null);
  const sleeveCaptureImagesReference = useRef<HTMLImageElement[]>([]);
  const cameraReference = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsReference = useRef<OrbitControls | null>(null);
  const viewReference = useRef<{
    position: THREE.Vector3;
    target: THREE.Vector3;
  } | null>(null);
  const paperReadyReference = useRef<Promise<unknown>>(Promise.resolve());
  const [paperLoading, setPaperLoading] = useState(false);
  const [error, setError] = useState("");
  const [zoomPercent, setZoomPercent] = useState(INITIAL_ZOOM_PERCENT);
  const [sharing, setSharing] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const shareInFlight = useRef(false);
  const [shareError, setShareError] = useState("");
  useEffect(() => {
    setShareUrl(null);
    setShareError("");
  }, [
    modelShareId,
    modelTitle,
    labelCapture,
    labelCaptureBack,
    sleeveColor,
    sleeveMaterial,
    labelColor,
    sleeveCaptureFront,
    sleeveCaptureBack,
    sleeveImage,
    sleeveZoom,
    sleeveImageOffsetX,
    sleeveImageOffsetY,
    windows?.A,
    windows?.B,
    foilMasks?.A,
    foilMasks?.B,
    foilMasks?.sleeveA,
    foilMasks?.sleeveB,
    reliefMasks,
  ]);
  const pressingPresetReference = useRef<PressingPreset>(pressingPreset);
  const pressingMarksReference = useRef(pressingMarks);
  const applyPressingReference = useRef<
    ((preset: PressingPreset) => void) | null
  >(null);

  useEffect(() => {
    const container = host.current;
    if (!container) return;

    let active = true;
    setError("");
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
    const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
    camera.position.copy(
      viewReference.current?.position ?? INITIAL_CAMERA_POSITION,
    );
    // A soft frontal key follows the viewer, remaining above-left even when
    // orbiting to side B. This is preview lighting, not exported geometry.
    const viewerLight = new THREE.DirectionalLight(0xffffff, 1.8);
    viewerLight.position.set(-3, 4, 3);
    viewerLight.target.position.set(0, 0, -4);
    camera.add(viewerLight, viewerLight.target);
    scene.add(camera);
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
    captureSharePreview.current = async () => {
      // Copy immediately after rendering: the WebGL drawing buffer need not
      // be preserved between frames. Never change the user's camera or zoom.
      renderer.render(scene, camera);
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 630;
      const context = canvas.getContext("2d");
      if (!context) throw Error("The model preview could not be captured.");
      context.fillStyle = "#eceee5";
      context.fillRect(0, 0, canvas.width, canvas.height);
      const image = renderer.domElement;
      const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
      const width = image.width * scale, height = image.height * scale;
      context.drawImage(image, (canvas.width-width)/2, (canvas.height-height)/2, width, height);
      return new Promise<Blob>((resolve, reject) => canvas.toBlob(
        blob => blob ? resolve(blob) : reject(Error("The model preview could not be captured.")),
        "image/png",
      ));
    };
    const artworkTextureSize = Math.min(
      4096,
      renderer.capabilities.maxTextureSize,
    );
    let environment: THREE.WebGLRenderTarget | undefined;
    // The exposed vinyl needs studio reflections even with an entirely matte sleeve.
    {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const studio = new RoomEnvironment();
      environment = pmrem.fromScene(studio);
      scene.environment = environment.texture;
      studio.dispose();
      pmrem.dispose();
    }
    container.style.background = `#e5e7e1 url("${previewBackgroundUrl}") center / cover no-repeat`;
    container.append(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = INITIAL_CAMERA_DISTANCE / (MAX_ZOOM_PERCENT / 100);
    controls.maxDistance = 10;
    controls.target.copy(viewReference.current?.target ?? new THREE.Vector3());
    let lastZoomPercent = Math.round(
      (INITIAL_CAMERA_DISTANCE / camera.position.distanceTo(controls.target)) *
        100,
    );
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
    const pressingLight = new THREE.DirectionalLight(0xffffff, 0);
    pressingLight.position.set(-3, 1, 0.8);
    scene.add(pressingLight);

    const sleeveSize = SLEEVE_SIZE_MM * WORLD_SCALE;
    const cookieRecessDepth = 0.012;
    const cookieThicknessScale = 0.8;
    const cookieDepth = 0.012 * cookieThicknessScale;
    const vinylSurfaceZ = cookieDepth / 2 + 0.0025;
    const sleeveDepth = cookieDepth + cookieRecessDepth * 2;
    const cookieBevelSize = 0.006;
    const cookieBevelThickness = 0.002;
    const labelRadius = (labelDiameterMm / 2) * WORLD_SCALE;
    const reliefSurfaces: {
      geometry: THREE.BufferGeometry;
      face: 1 | -1 | 0;
    }[] = [];
    const applyPressing = (preset: PressingPreset) => {
      pressingLight.intensity = preset === "flat" ? 0 : 0.8;
      for (const surface of reliefSurfaces)
        applyPressingRelief(
          surface.geometry,
          labelRadius,
          preset,
          surface.face,
          pressingMarksReference.current,
        );
    };
    applyPressingReference.current = applyPressing;
    const holeRadius = (labelHoleMm / 2) * WORLD_SCALE;
    const cookieRecessInnerRadius = labelRadius - cookieBevelSize - 0.0005;
    const cookieRecessLipWidth = cookieRecessDepth;
    const cookieRecessOpeningRadius =
      cookieRecessInnerRadius + cookieRecessLipWidth;

    const createSleeveTexture = () => {
      const canvas = document.createElement("canvas");
      canvas.width = artworkTextureSize;
      canvas.height = artworkTextureSize;
      const context = canvas.getContext("2d");
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
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
      const requiredSize = capture?.naturalWidth === 1 ? 1 : artworkTextureSize;
      if (canvas.width !== requiredSize) canvas.width = canvas.height = requiredSize;
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
    const shell = createSleeveShell(
      sleeveSize,
      sleeveDepth,
      cookieRecessOpeningRadius,
      sleeveFront.texture,
      sleeveBack.texture,
      sleeveColor,
      windows,
      sleeveMaterial,
      vinylSurfaceZ,
    );
    shell.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        if (material.normalMap)
          material.normalMap.anisotropy =
            renderer.capabilities.getMaxAnisotropy();
      }
    });
    model.add(shell);
    const retiredPrintTextures = new Set<THREE.Texture>();
    setPaperLoading(sleeveMaterial === "matte");
    const classicPaper =
      sleeveMaterial === "matte"
        ? loadClassicSleevePaper().catch((error) => {
            console.error("[Sleeve3DPreview] Paper loading failed:", error);
            throw error;
          })
        : null;
    paperReadyReference.current = classicPaper ?? Promise.resolve();
    if (classicPaper) {
      void classicPaper.then(
        (maps) => {
          if (!active) {
            maps.forEach((map) => map.dispose());
            return;
          }
          setPaperLoading(false);
        },
        (failure) => {
          if (active) {
            setPaperLoading(false);
            setError(
              failure instanceof Error
                ? failure.message
                : "Classic paper could not be loaded.",
            );
          }
        },
      );
    }
    const applyCapturedRelief = (
      material: THREE.MeshPhysicalMaterial,
      masks: ReliefMasks | undefined,
      mm: number,
      flip = false,
    ) => {
      if (!masks) return;
      const entries = Object.entries(masks).filter(([, url]) => url) as [
        keyof ReliefMasks,
        string,
      ][];
      if (!entries.length) return;
      const images: Partial<Record<keyof ReliefMasks, HTMLImageElement>> = {};
      let remaining = entries.length,
        failed = false;
      for (const [key, url] of entries) {
        const image = new Image();
        images[key] = image;
        labelImages.push(image);
        image.addEventListener("load", () => {
          if (--remaining === 0 && active && !failed) {
            const oldRoughness = material.roughnessMap;
            const old = applyPrintRelief(material, images, mm, flip);
            if (oldRoughness && oldRoughness !== material.roughnessMap)
              retiredPrintTextures.add(oldRoughness);
            for (const map of [
              material.normalMap,
              material.roughnessMap,
              material.clearcoatMap,
            ]) {
              if (map) {
                map.anisotropy = renderer.capabilities.getMaxAnisotropy();
                map.needsUpdate = true;
              }
            }
            if (old) retiredPrintTextures.add(old);
          }
        });
        image.addEventListener("error", () => {
          failed = true;
          if (active) setError("The print finish mask could not be loaded.");
        });
        image.src = url;
      }
    };
    const sleevePrints = [0, 1].map(
      (index) =>
        (
          shell.children[index] as THREE.Mesh<
            THREE.BufferGeometry,
            THREE.MeshPhysicalMaterial[]
          >
        ).material[0],
    );
    const applySleeveRelief = () =>
      sleevePrints.forEach((material, index) =>
        applyCapturedRelief(
          material,
          index === 0 ? reliefMasks?.sleeveA : reliefMasks?.sleeveB,
          SLEEVE_SIZE_MM,
          index === 1,
        ),
      );
    if (classicPaper) {
      void classicPaper
        .then(([normalMap, roughnessMap]) => {
          if (!active) return;
          for (const material of sleevePrints) {
            if (material.normalMap)
              retiredPrintTextures.add(material.normalMap);
            if (material.roughnessMap)
              retiredPrintTextures.add(material.roughnessMap);
            material.normalMap = normalMap;
            material.roughnessMap = roughnessMap;
            material.normalScale.set(0.12, 0.12);
            normalMap.anisotropy = roughnessMap.anisotropy =
              renderer.capabilities.getMaxAnisotropy();
            material.needsUpdate = true;
          }
          applySleeveRelief();
        })
        .catch((error) => {
          console.error("[Sleeve3DPreview] Paper application failed:", error);
        });
    } else {
      applySleeveRelief();
    }
    const applyCapturedFoil = (
      surface: THREE.Mesh,
      capture?: string,
      flip = false,
      printGroupsOnly = false,
    ) => {
      if (!capture) return;
      const image = new Image();
      labelImages.push(image);
      image.addEventListener("load", () => {
        if (!active) return;
        // A separate transparent metal surface blends edge coverage with the
        // actual printed background, not with a partly metallic paper shader.
        const geometry = printGroupsOnly
          ? surface.geometry.clone()
          : surface.geometry;
        if (printGroupsOnly) {
          const printGroups = geometry.groups.filter(
            (group) => group.materialIndex === 0,
          );
          geometry.clearGroups();
          for (const group of printGroups)
            geometry.addGroup(group.start, group.count, 0);
        }
        const material = new THREE.MeshPhysicalMaterial({
          side: THREE.DoubleSide,
        });
        applyFoilMask(material, image, flip);
        if (material.map)
          material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
        const foil = new THREE.Mesh(
          geometry,
          printGroupsOnly ? [material] : material,
        );
        foil.name = "Hot Foil Silver";
        foil.renderOrder = 1;
        surface.add(foil);
      });
      image.addEventListener("error", () => {
        if (active) setError("The foil material mask could not be loaded.");
      });
      image.src = capture;
    };
    applyCapturedFoil(
      shell.children[0] as THREE.Mesh,
      foilMasks?.sleeveA,
      false,
      true,
    );
    applyCapturedFoil(
      shell.children[1] as THREE.Mesh,
      foilMasks?.sleeveB,
      true,
      true,
    );
    const cookieGeometry = createCookieCoreGeometry(
      labelRadius,
      holeRadius,
      cookieDepth,
      cookieBevelSize,
      cookieBevelThickness,
    );
    reliefSurfaces.push({ geometry: cookieGeometry, face: 0 });
    applyPressing(pressingPresetReference.current);
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

    // The record is planar beneath the sleeve, with the label just above it.
    // Continue to the real 12-inch radius so oblique views cannot see through
    // the sleeve cavity beyond a short decorative rim.
    for (const face of [1, -1]) {
      const innerRadius = labelRadius - cookieBevelSize;
      const outerRadius = (VINYL_DIAMETER_MM / 2) * WORLD_SCALE;
      const shoulderGeometry = new THREE.RingGeometry(
        innerRadius,
        outerRadius,
        256,
        1,
      );
      // RingGeometry faces +Z by default. Rotate the back face's winding too,
      // not just its position: AR renderers must see its outward front side.
      if (face === -1) shoulderGeometry.rotateX(Math.PI);
      const positions = shoulderGeometry.getAttribute("position");
      // The vinyl strip meets the printed label at exactly the same plane.
      const vinylZ = vinylSurfaceZ;
      for (let i = 0; i < positions.count; i++) {
        positions.setZ(i, face * vinylZ);
      }
      positions.needsUpdate = true;
      shoulderGeometry.computeVertexNormals();
      const shoulder = new THREE.Mesh(
        shoulderGeometry,
        new THREE.MeshPhysicalMaterial({
          color: 0x12_12_12,
          roughness: 0.18,
          metalness: 0,
          clearcoat: 0.65,
          clearcoatRoughness: 0.1,
          ior: 1.54,
          envMapIntensity: 1.2,
          side: THREE.DoubleSide,
        }),
      );
      shoulder.name =
        face === 1 ? "Front flat vinyl surface" : "Back flat vinyl surface";
      model.add(shoulder);
    }
    const vinylRadius = (VINYL_DIAMETER_MM / 2) * WORLD_SCALE;
    const vinylEdgeGeometry = new THREE.CylinderGeometry(
      vinylRadius,
      vinylRadius,
      vinylSurfaceZ * 2,
      256,
      1,
      true,
    );
    vinylEdgeGeometry.rotateX(Math.PI / 2);
    const vinylEdge = new THREE.Mesh(
      vinylEdgeGeometry,
      new THREE.MeshPhysicalMaterial({
        color: 0x12_12_12,
        roughness: 0.18,
        metalness: 0,
        clearcoat: 0.65,
        clearcoatRoughness: 0.1,
        ior: 1.54,
        envMapIntensity: 1.2,
      }),
    );
    vinylEdge.name = "Outer vinyl edge";
    model.add(vinylEdge);

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
      const material = new THREE.MeshPhysicalMaterial({
        roughness: 0.46,
        metalness: 0,
        specularIntensity: 0.81,
        clearcoat: 0.081,
        clearcoatRoughness: 0.38,
        transparent: true,
        side: THREE.DoubleSide,
      });
      material.normalMap = createCookiePaperTexture();
      material.normalMap.anisotropy = renderer.capabilities.getMaxAnisotropy();
      material.roughnessMap = createCookiePaperRoughnessTexture();
      material.roughnessMap.anisotropy =
        renderer.capabilities.getMaxAnisotropy();
      material.normalScale.set(0.5, 0.5);
      const label = new THREE.Mesh(
        new THREE.RingGeometry(
          holeRadius,
          labelRadius - cookieBevelSize,
          256,
          384,
        ),
        material,
      );
      label.position.z = z;
      if (back) label.rotation.y = Math.PI;
      reliefSurfaces.push({ geometry: label.geometry, face: 1 });
      applyPressingRelief(
        label.geometry,
        labelRadius,
        pressingPresetReference.current,
        1,
        pressingMarksReference.current,
      );
      applyCapturedFoil(label, back ? foilMasks?.B : foilMasks?.A);
      applyCapturedRelief(
        material,
        back ? reliefMasks?.B : reliefMasks?.A,
        labelDiameterMm,
      );
      const labelImage = new Image();
      labelImages.push(labelImage);
      labelImage.addEventListener("load", () => {
        if (!active) return;
        const labelCanvas = document.createElement("canvas");
        labelCanvas.width = artworkTextureSize;
        labelCanvas.height = artworkTextureSize;
        const context = labelCanvas.getContext("2d");
        if (!context) return;
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(
          labelImage,
          0,
          0,
          labelCanvas.width,
          labelCanvas.height,
        );
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
        material.map = labelTexture;
        material.needsUpdate = true;
        // Both local faces point outward; rotating the back mesh mirrors its
        // deformation automatically and preserves the captured artwork UVs.
        model.add(label);
      });
      labelImage.addEventListener("error", () => {
        if (active) setError("The captured label artwork could not be loaded.");
      });
      labelImage.src = capture;
    };
    addLabelFace(labelCapture, vinylSurfaceZ);
    addLabelFace(labelCaptureBack, -vinylSurfaceZ, true);

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
      captureSharePreview.current = null;
      viewReference.current = {
        position: camera.position.clone(),
        target: controls.target.clone(),
      };
      applyPressingReference.current = null;
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
          material.metalnessMap?.dispose();
          material.roughnessMap?.dispose();
          material.alphaMap?.dispose();
          material.normalMap?.dispose();
          material.clearcoatMap?.dispose();
          material.dispose();
        }
      });
      sleeveImageElement?.removeAttribute("src");
      sleeveCaptureImages.forEach((image) => image.removeAttribute("src"));
      labelImages.forEach((image) => image.removeAttribute("src"));
      for (const texture of retiredPrintTextures) texture.dispose();
      renderer.dispose();
      environment?.dispose();
      renderer.domElement.remove();
      container.style.background = previousContainerBackground;
    };
  }, [
    labelCapture,
    labelCaptureBack,
    labelDiameterMm,
    sleeveColor,
    sleeveMaterial,
    labelColor,
    labelHoleMm,
    sleeveImage,
    sleeveCaptureFront,
    sleeveCaptureBack,
    sleeveZoom,
    sleeveImageOffsetX,
    sleeveImageOffsetY,
    windows?.A,
    windows?.B,
    foilMasks?.A,
    foilMasks?.B,
    foilMasks?.sleeveA,
    foilMasks?.sleeveB,
    reliefMasks,
  ]);

  const exportModel = async () => {
    const model = modelReference.current;
    if (!model) throw Error("The 3D preview is not ready yet.");
    await paperReadyReference.current;
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
      new GLTFExporter().register(vinylWebpPlugin).parse(
        prepareVinylModelExport(model),
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
    if (shareInFlight.current) return;
    if (shareUrl) {
      window.open(shareUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (!accountAuth.currentUser) {
      setShareError("");
      setSignInOpen(true);
      return;
    }
    shareInFlight.current = true;
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
        modelTitle,
        setUploadProgress,
        modelShareId,
        await captureSharePreview.current?.(),
      );
      const url = `${window.location.origin}/${shared.id}`;
      if (import.meta.env.DEV) {
        console.info("[Sleeve3DPreview/share] public-link-created", {
          id: shared.id,
          url,
        });
      }
      setShareUrl(url);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (shareFailure) {
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
      shareInFlight.current = false;
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

  const changePressingPreset = (preset: PressingPreset) => {
    setShareUrl(null);
    pressingPresetReference.current = preset;
    onPressingPresetChange(preset);
    applyPressingReference.current?.(preset);
  };
  const changePressingMarks = (enabled: boolean) => {
    setShareUrl(null);
    pressingMarksReference.current = enabled;
    onPressingMarksChange(enabled);
    applyPressingReference.current?.(pressingPresetReference.current);
  };

  return (
    <div className="dc-3d-preview">
      {headingTarget &&
        createPortal(
          <PressingPresetPicker
            value={pressingPreset}
            onChange={changePressingPreset}
            disabled={sharing || paperLoading}
            marksEnabled={pressingMarks}
            onMarksChange={changePressingMarks}
            sleeveMaterial={sleeveMaterial}
            onSleeveMaterialChange={onSleeveMaterialChange}
          />,
          headingTarget,
        )}
      <div
        className="dc-3d-scene"
        ref={host}
        aria-label="Interactive 3D sleeve with captured front and back labels"
      >
        <a
          className="dc-3d-watermark"
          href="https://strangeanimals.de/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Strange Animals home (opens in a new tab)"
        >
          <img
            src="/media/images/logos/sa-logo.png"
            alt="Strange Animals"
            draggable={false}
          />
        </a>
        {paperLoading && (
          <span className="dc-paper-loading" role="status">
            Loading sleeve texture…
          </span>
        )}
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
            disabled={sharing || paperLoading}
            onClick={() => void shareModel()}
          >
            {sharing ? (
              <span>{Math.round(uploadProgress * 100)}%</span>
            ) : (
              <Share2 size={15} />
            )}
          </button>
          <button
            aria-label="Zoom out 3D preview"
            title="Zoom out"
            onClick={() => {
              changeZoom(1.2);
            }}
          >
            <Minus size={16} />
          </button>
          <output className="dc-3d-zoom-level" aria-label="3D zoom level">
            {zoomPercent}%
          </output>
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
