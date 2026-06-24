import {useEffect} from 'react';
import * as THREE from 'three';
import {useMediaAssets} from '@/media/react/MediaProvider';
import {gameConfig} from '../lib/game-config';
import {
  getViewportSizeAtZ,
  getWorldPositionFromPointerAtZ,
} from './three-utils';

type UseThreeLogoSceneOptions = {
  canvasReference: React.RefObject<HTMLCanvasElement>;
  backdropReference: React.RefObject<HTMLDivElement>;
};

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D tex;
  uniform float time;
  uniform vec2 mousePos;
  varying vec2 vUv;

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    vec2 cursorDist = (vUv - mousePos) * 2.0;
    float dist = length(cursorDist);
    float influence = smoothstep(0.8, 0.0, dist);
    vec2 n = vec2(
      noise(vUv * 5.0 + mousePos * 2.0 + time * 0.3),
      noise(vUv * 5.0 + mousePos * 2.0 + time * 0.3 + 10.0)
    );
    vec2 uv = vUv + (n - 0.5) * influence * 0.05;
    gl_FragColor = texture2D(tex, uv);
  }
`;

export function useThreeLogoScene({
  canvasReference,
  backdropReference,
}: UseThreeLogoSceneOptions) {
  const assets = useMediaAssets();

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
    const logoOffset = new THREE.Vector2();
    const dragOffset = new THREE.Vector2();
    const uniforms = {
      tex: {value: null as THREE.Texture | null},
      time: {value: 0},
      mousePos: {value: new THREE.Vector2(0.5, 0.5)},
    };
    let logoMesh: THREE.Mesh | null = null;
    let logoAspectRatio = 1;
    let dragging = false;
    let animationFrame = 0;

    camera.position.z = 1;
    renderer.setClearColor(0x00_00_00, 0);

    const getLogoMaxWidthPx = () => {
      const rootFontSize = Number.parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      );

      return Math.min(
        gameConfig.logoMaxWidthRem * rootFontSize,
        window.innerWidth - 32,
      );
    };

    const updateBackdrop = () => {
      const backdrop = backdropReference.current;

      if (!backdrop || !logoMesh) {
        return;
      }

      const viewport = getViewportSizeAtZ(camera, 0);
      const offsetX = (logoOffset.x / viewport.width) * window.innerWidth;
      const offsetY = (-logoOffset.y / viewport.height) * window.innerHeight;
      const logoHalfHeight = getLogoMaxWidthPx() / logoAspectRatio / 2;

      backdrop.style.setProperty('--brand-offset-x', `${offsetX}px`);
      backdrop.style.setProperty('--brand-offset-y', `${offsetY}px`);
      backdrop.style.setProperty('--logo-half-height', `${logoHalfHeight}px`);
    };

    const keepLogoInsideViewport = () => {
      if (!logoMesh) {
        return;
      }

      const viewport = getViewportSizeAtZ(camera, 0);
      const halfWidth = logoMesh.scale.x / 2;
      const halfHeight = logoMesh.scale.y / 2;

      logoOffset.x = THREE.MathUtils.clamp(
        logoOffset.x,
        -viewport.width / 2 + halfWidth,
        viewport.width / 2 - halfWidth,
      );
      logoOffset.y = THREE.MathUtils.clamp(
        logoOffset.y,
        -viewport.height / 2 + halfHeight,
        viewport.height / 2 - halfHeight,
      );
      logoMesh.position.set(logoOffset.x, logoOffset.y, 0);
      updateBackdrop();
    };

    const updateSize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight, false);

      if (logoMesh) {
        const viewport = getViewportSizeAtZ(camera, 0);
        const width =
          (getLogoMaxWidthPx() / window.innerWidth) * viewport.width;
        logoMesh.scale.set(width, width / logoAspectRatio, 1);
        keepLogoInsideViewport();
      }
    };

    const isPointerOverLogo = (event: PointerEvent) => {
      if (!logoMesh) {
        return false;
      }

      const pointer = getWorldPositionFromPointerAtZ(camera, event, 0);
      const halfWidth = logoMesh.scale.x / 2;
      const halfHeight = logoMesh.scale.y / 2;

      return (
        pointer.x >= logoOffset.x - halfWidth &&
        pointer.x <= logoOffset.x + halfWidth &&
        pointer.y >= logoOffset.y - halfHeight &&
        pointer.y <= logoOffset.y + halfHeight
      );
    };

    const startDrag = (event: PointerEvent) => {
      const target = event.target as Element | null;

      if (target?.closest('a, button, #webamp') || !isPointerOverLogo(event)) {
        return;
      }

      event.preventDefault();
      dragging = true;
      dragOffset
        .copy(logoOffset)
        .sub(getWorldPositionFromPointerAtZ(camera, event, 0));
      document.body.classList.add('cursor-grabbing');
    };

    const drag = (event: PointerEvent) => {
      if (!dragging) {
        return;
      }

      event.preventDefault();
      const pointer = getWorldPositionFromPointerAtZ(camera, event, 0);
      logoOffset.copy(pointer).add(dragOffset);
      keepLogoInsideViewport();
    };

    const stopDrag = () => {
      dragging = false;
      document.body.classList.remove('cursor-grabbing');
    };

    const animate = () => {
      uniforms.time.value += 0.01;
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    };

    loader.load(assets.images.logo, (texture) => {
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      uniforms.tex.value = texture;
      logoAspectRatio = texture.image.width / texture.image.height;
      logoMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.ShaderMaterial({
          fragmentShader,
          transparent: true,
          uniforms,
          vertexShader,
        }),
      );
      scene.add(logoMesh);
      updateSize();
    });

    const handleMouseMove = (event: MouseEvent) => {
      uniforms.mousePos.value.set(
        event.clientX / window.innerWidth,
        1 - event.clientY / window.innerHeight,
      );
    };

    updateSize();
    animate();
    window.addEventListener('resize', updateSize);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('pointerdown', startDrag);
    window.addEventListener('pointermove', drag);
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', updateSize);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('pointerdown', startDrag);
      window.removeEventListener('pointermove', drag);
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', stopDrag);
      renderer.dispose();
    };
  }, [assets.images.logo, backdropReference, canvasReference]);
}
