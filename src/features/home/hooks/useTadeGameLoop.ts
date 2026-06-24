import {useEffect, useRef} from 'react';
import * as THREE from 'three';
import {useMediaAssets} from '@/media/react/MediaProvider';
import {useTadeGameStore} from '@/store/tade-game-store';
import {gameConfig} from '../lib/game-config';
import {
  getScreenPositionFromWorld,
  getTextureAlphaBounds,
  getViewportSizeAtZ,
  getWorldPositionFromPointerAtZ,
  getWorldWidthFromPixels,
} from './three-utils';

type UseTadeGameLoopOptions = {
  canvasReference: React.RefObject<HTMLCanvasElement>;
  hoopReference: React.RefObject<HTMLImageElement>;
  onScorePop: (points: number, position: {x: number; y: number}) => void;
};

const tadeVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const tadeFragmentShader = `
  uniform sampler2D tex;
  uniform float blurRadius;
  uniform float hueShift;
  uniform float opacity;
  uniform vec2 texelSize;
  varying vec2 vUv;

  vec3 shiftHue(vec3 color, float angle) {
    const vec3 weights = vec3(0.57735, 0.57735, 0.57735);
    float cosAngle = cos(angle);
    return color * cosAngle + cross(weights, color) * sin(angle) + weights * dot(weights, color) * (1.0 - cosAngle);
  }

  void main() {
    vec2 blur = texelSize * blurRadius;
    vec4 color = texture2D(tex, vUv) * 0.28;
    color += texture2D(tex, vUv + vec2(blur.x, 0.0)) * 0.12;
    color += texture2D(tex, vUv - vec2(blur.x, 0.0)) * 0.12;
    color += texture2D(tex, vUv + vec2(0.0, blur.y)) * 0.12;
    color += texture2D(tex, vUv - vec2(0.0, blur.y)) * 0.12;
    color += texture2D(tex, vUv + blur) * 0.06;
    color += texture2D(tex, vUv - blur) * 0.06;
    color += texture2D(tex, vUv + vec2(blur.x, -blur.y)) * 0.06;
    color += texture2D(tex, vUv + vec2(-blur.x, blur.y)) * 0.06;
    color.rgb = clamp(shiftHue(color.rgb, hueShift), 0.0, 1.0);
    color.a *= opacity;
    gl_FragColor = color;
  }
`;

type Bounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

function doRectsOverlap(first: Bounds, second: Bounds) {
  return (
    first.right > second.left &&
    first.left < second.right &&
    first.bottom > second.top &&
    first.top < second.bottom
  );
}

function isPointInTriangle(
  point: {x: number; y: number},
  triangle: Array<{x: number; y: number}>,
) {
  const [a, b, c] = triangle;
  const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);

  if (denominator === 0) {
    return false;
  }

  const first =
    ((b.y - c.y) * (point.x - c.x) + (c.x - b.x) * (point.y - c.y)) /
    denominator;
  const second =
    ((c.y - a.y) * (point.x - c.x) + (a.x - c.x) * (point.y - c.y)) /
    denominator;
  const third = 1 - first - second;

  return first >= 0 && second >= 0 && third >= 0;
}

export function useTadeGameLoop({
  canvasReference,
  hoopReference,
  onScorePop,
}: UseTadeGameLoopOptions) {
  const assets = useMediaAssets();
  const active = useTadeGameStore((state) => state.active);
  const speedMultiplier = useTadeGameStore((state) => state.speedMultiplier);
  const addScore = useTadeGameStore((state) => state.addScore);
  const speedMultiplierReference = useRef(speedMultiplier);
  const activeReference = useRef(active);

  useEffect(() => {
    speedMultiplierReference.current = speedMultiplier;
  }, [speedMultiplier]);

  useEffect(() => {
    activeReference.current = active;
  }, [active]);

  useEffect(() => {
    const canvas = canvasReference.current;

    if (!canvas) {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas,
    });
    const loader = new THREE.TextureLoader();
    const velocity = new THREE.Vector2(
      gameConfig.tadeBaseVelocity.x,
      gameConfig.tadeBaseVelocity.y,
    );
    const dragOffset = new THREE.Vector2();
    let mesh: THREE.Mesh | null = null;
    let uniforms: Record<string, {value: unknown}> | null = null;
    let alphaBounds = {left: -0.5, right: 0.5, top: 0.5, bottom: -0.5};
    let tadeAspectRatio = 1;
    let hueShiftActive = false;
    let fadeInStart: number | null = null;
    let fadeOutStart: number | null = null;
    let respawning = false;
    let hoopScoreArmed = true;
    let dragging = false;
    let animationFrame = 0;
    let startTimer = 0;

    camera.position.z = 1;
    renderer.setClearColor(0x00_00_00, 0);

    const updateSize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight, false);

      if (mesh) {
        const rootFontSize = Number.parseFloat(
          getComputedStyle(document.documentElement).fontSize,
        );
        const width = getWorldWidthFromPixels(
          camera,
          gameConfig.tadeWidthRem * rootFontSize,
        );
        mesh.scale.set(width, width / tadeAspectRatio, 1);
      }
    };

    const getVisibleWorldBounds = (position = mesh?.position) => {
      if (!mesh || !position) {
        return null;
      }

      return {
        left: position.x + alphaBounds.left * mesh.scale.x,
        right: position.x + alphaBounds.right * mesh.scale.x,
        top: position.y + alphaBounds.top * mesh.scale.y,
        bottom: position.y + alphaBounds.bottom * mesh.scale.y,
      };
    };

    const keepInsideViewport = () => {
      if (!mesh) {
        return;
      }

      const viewport = getViewportSizeAtZ(camera, mesh.position.z);
      const bounds = getVisibleWorldBounds();
      const bleed = getWorldWidthFromPixels(camera, 8);

      if (!bounds) {
        return;
      }

      if (bounds.left < -viewport.width / 2 - bleed) {
        mesh.position.x += -viewport.width / 2 - bleed - bounds.left;
      }

      if (bounds.right > viewport.width / 2 + bleed) {
        mesh.position.x -= bounds.right - (viewport.width / 2 + bleed);
      }

      if (bounds.bottom < -viewport.height / 2 - bleed) {
        mesh.position.y += -viewport.height / 2 - bleed - bounds.bottom;
      }

      if (bounds.top > viewport.height / 2 + bleed) {
        mesh.position.y -= bounds.top - (viewport.height / 2 + bleed);
      }
    };

    const placeAtStart = () => {
      if (!mesh) {
        return;
      }

      const viewport = getViewportSizeAtZ(camera, mesh.position.z);
      const margin = getWorldWidthFromPixels(camera, 24);
      mesh.position.x =
        -viewport.width / 2 - alphaBounds.left * mesh.scale.x + margin;
      mesh.position.y =
        -viewport.height / 2 - alphaBounds.bottom * mesh.scale.y + margin;
      ensureSafeSpawnPosition();
      velocity.x = Math.abs(velocity.x);
      velocity.y = Math.abs(velocity.y);
    };

    const placeRandomly = () => {
      if (!mesh) {
        return;
      }

      placeAtSafeRandomPosition();
      velocity.x = Math.abs(velocity.x) * (Math.random() < 0.5 ? -1 : 1);
      velocity.y = Math.abs(velocity.y) * (Math.random() < 0.5 ? -1 : 1);
    };

    const getTadeScreenBounds = (position = mesh?.position) => {
      if (!mesh || !position) {
        return null;
      }

      const center = getScreenPositionFromWorld(camera, position, position.z);
      const viewport = getViewportSizeAtZ(camera, position.z);
      const width = (mesh.scale.x / viewport.width) * window.innerWidth;
      const height = (mesh.scale.y / viewport.height) * window.innerHeight;

      return {
        left: center.x - width / 2,
        right: center.x + width / 2,
        top: center.y - height / 2,
        bottom: center.y + height / 2,
        centerX: center.x,
        centerY: center.y,
      };
    };

    const getHoopCollisionRect = () => {
      const rect = hoopReference.current?.getBoundingClientRect();

      if (!rect) {
        return null;
      }

      return {
        left: rect.left + rect.width * 0.03,
        right: rect.left + rect.width * 0.97,
        top: rect.top + rect.height * 0.12,
        bottom: rect.top + rect.height * 0.94,
      };
    };

    const getHoopRimOpening = () => {
      const rect = hoopReference.current?.getBoundingClientRect();

      if (!rect) {
        return null;
      }

      const rimLeft = rect.left + rect.width * 0.18;
      const rimRight = rect.left + rect.width * 0.94;
      const rimWidth = rimRight - rimLeft;

      return {
        bottom: rect.top + rect.height * 0.38,
        center: rimLeft + rimWidth * 0.5,
        left: rimLeft + rimWidth * 0.1,
        right: rimRight - rimWidth * 0.1,
        top: rect.top + rect.height * 0.13,
      };
    };

    const getHoopScoreTriangle = () => {
      const opening = getHoopRimOpening();

      if (!opening) {
        return null;
      }

      return [
        {x: opening.left, y: opening.top},
        {x: opening.right, y: opening.top},
        {x: opening.center, y: opening.bottom},
      ];
    };

    const getLogoBackdropRect = () => {
      const backdrop = document.querySelector('[data-brand-backdrop]');
      return backdrop?.getBoundingClientRect() ?? null;
    };

    const getSpawnBlockers = () =>
      [getHoopCollisionRect(), getLogoBackdropRect()].filter(
        (rect): rect is DOMRect | Bounds => rect !== null,
      );

    const overlapsSpawnBlocker = (position = mesh?.position) => {
      const bounds = getTadeScreenBounds(position);

      if (!bounds) {
        return true;
      }

      return getSpawnBlockers().some((blocker) =>
        doRectsOverlap(bounds, blocker),
      );
    };

    const placeAtSafeRandomPosition = () => {
      if (!mesh) {
        return;
      }

      const viewport = getViewportSizeAtZ(camera, mesh.position.z);
      const margin = getWorldWidthFromPixels(camera, 32);
      const minX = -viewport.width / 2 + margin;
      const maxX = viewport.width / 2 - margin;
      const minY = -viewport.height / 2 + margin;
      const maxY = viewport.height / 2 - margin;

      for (let attempt = 0; attempt < 80; attempt += 1) {
        mesh.position.x = THREE.MathUtils.lerp(minX, maxX, Math.random());
        mesh.position.y = THREE.MathUtils.lerp(minY, maxY, Math.random());

        if (!overlapsSpawnBlocker()) {
          return;
        }
      }

      for (let row = 0; row < 6; row += 1) {
        for (let column = 0; column < 8; column += 1) {
          mesh.position.x = THREE.MathUtils.lerp(minX, maxX, column / 7);
          mesh.position.y = THREE.MathUtils.lerp(minY, maxY, row / 5);

          if (!overlapsSpawnBlocker()) {
            return;
          }
        }
      }
    };

    const ensureSafeSpawnPosition = () => {
      if (overlapsSpawnBlocker()) {
        placeAtSafeRandomPosition();
      }
    };

    const checkHoopScore = () => {
      if (!mesh || !activeReference.current || !mesh.visible || respawning) {
        return;
      }

      const tadeBounds = getTadeScreenBounds();
      const triangle = getHoopScoreTriangle();

      if (!tadeBounds || !triangle) {
        return;
      }

      const inside = isPointInTriangle(
        {x: tadeBounds.centerX, y: tadeBounds.centerY},
        triangle,
      );

      if (inside && hoopScoreArmed) {
        addScore(gameConfig.hoopScorePoints);
        onScorePop(gameConfig.hoopScorePoints, {
          x: tadeBounds.centerX,
          y: tadeBounds.centerY,
        });
        hoopScoreArmed = false;
        respawning = true;
        fadeOutStart = performance.now();
      }

      if (!inside) {
        hoopScoreArmed = true;
      }
    };

    const bounceOffHoop = (previousPosition: THREE.Vector3) => {
      if (!mesh?.visible || respawning) {
        return;
      }

      const currentBounds = getTadeScreenBounds();
      const previousBounds = getTadeScreenBounds(previousPosition);
      const hoopRect = getHoopCollisionRect();
      const opening = getHoopRimOpening();
      const triangle = getHoopScoreTriangle();

      if (
        !currentBounds ||
        !previousBounds ||
        !hoopRect ||
        !opening ||
        !triangle
      ) {
        return;
      }

      const centerPoint = {x: currentBounds.centerX, y: currentBounds.centerY};
      const previousCenterPoint = {
        x: previousBounds.centerX,
        y: previousBounds.centerY,
      };
      const centerInsideOpeningColumn =
        centerPoint.x >= opening.left && centerPoint.x <= opening.right;
      const enteringFromAbove =
        previousCenterPoint.y <= opening.top && centerPoint.y <= opening.bottom;

      if (
        !doRectsOverlap(currentBounds, hoopRect) ||
        (centerInsideOpeningColumn && enteringFromAbove) ||
        isPointInTriangle(centerPoint, triangle)
      ) {
        return;
      }

      const wasOutsideHorizontally =
        previousBounds.right <= hoopRect.left ||
        previousBounds.left >= hoopRect.right;
      const wasOutsideVertically =
        previousBounds.bottom <= hoopRect.top ||
        previousBounds.top >= hoopRect.bottom;
      const horizontalOverlap = Math.min(
        currentBounds.right - hoopRect.left,
        hoopRect.right - currentBounds.left,
      );
      const verticalOverlap = Math.min(
        currentBounds.bottom - hoopRect.top,
        hoopRect.bottom - currentBounds.top,
      );
      const bounceHorizontally =
        wasOutsideHorizontally ||
        (!wasOutsideVertically && horizontalOverlap < verticalOverlap);
      const bounceVertically =
        wasOutsideVertically ||
        (!wasOutsideHorizontally && verticalOverlap <= horizontalOverlap);

      if (bounceHorizontally) {
        velocity.x *= -1;
      }

      if (bounceVertically) {
        velocity.y *= -1;
      }

      mesh.position.copy(previousPosition);
      mesh.position.x += velocity.x * 3;
      mesh.position.y += velocity.y * 3;
      keepInsideViewport();
    };

    const bounceOffLogoBackdrop = (previousPosition: THREE.Vector3) => {
      if (!mesh?.visible || respawning) {
        return;
      }

      const currentBounds = getTadeScreenBounds();
      const previousBounds = getTadeScreenBounds(previousPosition);
      const logoRect = getLogoBackdropRect();

      if (!currentBounds || !previousBounds || !logoRect) {
        return;
      }

      if (!doRectsOverlap(currentBounds, logoRect)) {
        return;
      }

      const wasOutsideHorizontally =
        previousBounds.right <= logoRect.left ||
        previousBounds.left >= logoRect.right;
      const wasOutsideVertically =
        previousBounds.bottom <= logoRect.top ||
        previousBounds.top >= logoRect.bottom;

      if (wasOutsideHorizontally) {
        velocity.x *= -1;
      }

      if (wasOutsideVertically) {
        velocity.y *= -1;
      }

      if (!wasOutsideHorizontally && !wasOutsideVertically) {
        velocity.x *= -1;
        velocity.y *= -1;
      }

      mesh.position.copy(previousPosition);
      mesh.position.x += velocity.x * 3;
      mesh.position.y += velocity.y * 3;
      keepInsideViewport();
    };

    const moveTade = () => {
      if (!mesh?.visible || dragging || respawning) {
        return;
      }

      const previousPosition = mesh.position.clone();
      const viewport = getViewportSizeAtZ(camera, mesh.position.z);
      const speed = speedMultiplierReference.current;
      mesh.position.x += velocity.x * speed;
      mesh.position.y += velocity.y * speed;
      const bounds = getVisibleWorldBounds();

      if (!bounds) {
        return;
      }

      if (
        bounds.left <= -viewport.width / 2 ||
        bounds.right >= viewport.width / 2
      ) {
        velocity.x *= -1;
      }

      if (
        bounds.bottom <= -viewport.height / 2 ||
        bounds.top >= viewport.height / 2
      ) {
        velocity.y *= -1;
      }

      bounceOffHoop(previousPosition);
      bounceOffLogoBackdrop(previousPosition);
      keepInsideViewport();
    };

    const updateOpacity = () => {
      if (!uniforms) {
        return;
      }

      if (fadeOutStart !== null) {
        const progress = Math.min(
          (performance.now() - fadeOutStart) / gameConfig.tadeFadeOutDurationMs,
          1,
        );
        uniforms.opacity.value = 1 - progress;

        if (progress === 1) {
          placeRandomly();
          uniforms.opacity.value = 1;
          fadeOutStart = null;
          respawning = false;
        }

        return;
      }

      if (fadeInStart === null) {
        return;
      }

      const progress = Math.min(
        (performance.now() - fadeInStart) / gameConfig.tadeFadeDurationMs,
        1,
      );
      uniforms.opacity.value = progress * progress;

      if (progress === 1) {
        fadeInStart = null;
      }
    };

    const animate = () => {
      if (uniforms) {
        const time = performance.now() / 1000;
        uniforms.blurRadius.value =
          3 * (1 - (Math.sin((time / 5) * Math.PI * 2) + 1) / 2);
        uniforms.hueShift.value = hueShiftActive
          ? Math.sin(time * 0.9) * 1.15
          : 0;
      }

      updateOpacity();
      moveTade();
      checkHoopScore();
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    };

    const startTade = () => {
      if (!mesh || !uniforms) {
        return;
      }

      window.clearTimeout(startTimer);
      startTimer = window.setTimeout(() => {
        if (!mesh || !uniforms) {
          return;
        }

        mesh.visible = true;
        fadeInStart = performance.now();
        uniforms.opacity.value = 0;
        placeAtStart();
      }, gameConfig.tadeShowDelayMs);
    };

    const isPointerOverTade = (event: PointerEvent) => {
      if (!mesh?.visible) {
        return false;
      }

      const pointer = getWorldPositionFromPointerAtZ(
        camera,
        event,
        mesh.position.z,
      );
      const halfWidth = mesh.scale.x / 2;
      const halfHeight = mesh.scale.y / 2;

      return (
        pointer.x >= mesh.position.x - halfWidth &&
        pointer.x <= mesh.position.x + halfWidth &&
        pointer.y >= mesh.position.y - halfHeight &&
        pointer.y <= mesh.position.y + halfHeight
      );
    };

    const pointerDown = (event: PointerEvent) => {
      if (!mesh || !isPointerOverTade(event)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      dragging = true;
      dragOffset
        .copy(mesh.position)
        .sub(getWorldPositionFromPointerAtZ(camera, event, mesh.position.z));
      document.body.style.cursor = 'grabbing';
    };

    const pointerMove = (event: PointerEvent) => {
      if (!mesh || !dragging) {
        document.body.style.cursor = isPointerOverTade(event) ? 'grab' : '';
        return;
      }

      event.preventDefault();
      const pointer = getWorldPositionFromPointerAtZ(
        camera,
        event,
        mesh.position.z,
      );
      mesh.position.x = pointer.x + dragOffset.x;
      mesh.position.y = pointer.y + dragOffset.y;
      keepInsideViewport();
    };

    const pointerUp = () => {
      dragging = false;
      document.body.style.cursor = '';
    };

    loader.load(assets.images.tade, (texture) => {
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      tadeAspectRatio = texture.image.width / texture.image.height;
      alphaBounds = getTextureAlphaBounds(texture.image) ?? alphaBounds;
      uniforms = {
        tex: {value: texture},
        blurRadius: {value: 3},
        hueShift: {value: 0},
        opacity: {value: 0},
        texelSize: {
          value: new THREE.Vector2(
            1 / texture.image.width,
            1 / texture.image.height,
          ),
        },
      };
      mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.ShaderMaterial({
          depthWrite: false,
          fragmentShader: tadeFragmentShader,
          transparent: true,
          uniforms,
          vertexShader: tadeVertexShader,
        }),
      );
      mesh.position.z = -0.05;
      mesh.visible = false;
      scene.add(mesh);
      updateSize();

      if (activeReference.current) {
        startTade();
      }
    });

    updateSize();
    animate();
    window.addEventListener('resize', updateSize);
    document.addEventListener('pointerdown', pointerDown, {capture: true});
    window.addEventListener('pointermove', pointerMove);
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('pointercancel', pointerUp);
    const unsubscribe = useTadeGameStore.subscribe((state, previousState) => {
      if (state.active && !previousState.active) {
        activeReference.current = true;
        startTade();
      }
    });
    const keydown = (event: KeyboardEvent) => {
      if (activeReference.current && event.key.length === 1) {
        hueShiftActive = true;
      }
    };

    document.addEventListener('keydown', keydown);

    return () => {
      unsubscribe();
      window.clearTimeout(startTimer);
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', updateSize);
      document.removeEventListener('pointerdown', pointerDown, {capture: true});
      window.removeEventListener('pointermove', pointerMove);
      window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('pointercancel', pointerUp);
      document.removeEventListener('keydown', keydown);
      renderer.dispose();
    };
  }, [addScore, assets.images.tade, canvasReference, hoopReference, onScorePop]);
}
