import {useEffect, useRef} from 'react';
import Matter from 'matter-js';
import {useMediaAssets} from '@/media/react/MediaProvider';

type LogoPhysicsDropProperties = {
  active: boolean;
  trigger: number;
};

const getLogoStartRect = () => {
  const backdrop = document.querySelector('[data-brand-backdrop]');

  if (backdrop instanceof HTMLElement) {
    const rect = backdrop.getBoundingClientRect();
    const height = Math.max(54, rect.height - 24);
    const width = Math.max(180, Math.min(rect.width - 18, height * 5.4));

    return {
      height,
      width,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  const width = Math.min(350, window.innerWidth - 32);

  return {
    height: width / 5.4,
    width,
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  };
};

export function LogoPhysicsDrop({active, trigger}: LogoPhysicsDropProperties) {
  const assets = useMediaAssets();
  const containerReference = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerReference.current;

    if (!active || trigger === 0 || !container) {
      return;
    }

    container.replaceChildren();

    const startRect = getLogoStartRect();
    const engine = Matter.Engine.create({
      gravity: {x: 0, y: 1.18},
    });
    const render = Matter.Render.create({
      element: container,
      engine,
      options: {
        background: 'transparent',
        height: window.innerHeight,
        pixelRatio: window.devicePixelRatio,
        showAngleIndicator: false,
        showCollisions: false,
        showDebug: false,
        showVelocity: false,
        wireframes: false,
        width: window.innerWidth,
      },
    });
    const runner = Matter.Runner.create();
    const floor = Matter.Bodies.rectangle(
      window.innerWidth / 2,
      window.innerHeight + 18,
      window.innerWidth + 400,
      36,
      {
        isStatic: true,
        render: {visible: false},
      },
    );
    const leftWall = Matter.Bodies.rectangle(
      -30,
      window.innerHeight / 2,
      60,
      window.innerHeight * 2,
      {isStatic: true, render: {visible: false}},
    );
    const rightWall = Matter.Bodies.rectangle(
      window.innerWidth + 30,
      window.innerHeight / 2,
      60,
      window.innerHeight * 2,
      {isStatic: true, render: {visible: false}},
    );
    const logo = Matter.Bodies.rectangle(
      startRect.x,
      startRect.y,
      startRect.width,
      startRect.height,
      {
        angle: -0.04,
        friction: 0.36,
        frictionAir: 0.018,
        restitution: 0.72,
        render: {
          opacity: 1,
          sprite: {
            texture: assets.images.logo,
            xScale: startRect.width / 1200,
            yScale: startRect.height / 240,
          },
        },
      },
    );

    Matter.Body.setVelocity(logo, {
      x: window.innerWidth < 700 ? -1.4 : -2.8,
      y: -1.5,
    });
    Matter.Body.setAngularVelocity(logo, -0.015);
    Matter.Composite.add(engine.world, [floor, leftWall, rightWall, logo]);
    Matter.Render.run(render);
    Matter.Runner.run(runner, engine);

    const keepCanvasCrisp = () => {
      const canvas = render.canvas;
      canvas.style.height = '100%';
      canvas.style.width = '100%';
    };

    const handleResize = () => {
      render.canvas.width = window.innerWidth * window.devicePixelRatio;
      render.canvas.height = window.innerHeight * window.devicePixelRatio;
      render.options.width = window.innerWidth;
      render.options.height = window.innerHeight;
      Matter.Body.setPosition(floor, {
        x: window.innerWidth / 2,
        y: window.innerHeight + 18,
      });
      Matter.Body.setVertices(
        floor,
        Matter.Vertices.fromPath(
          '0 0 ' + (window.innerWidth + 400) + ' 0 ' + (window.innerWidth + 400) + ' 36 0 36',
        ),
      );
      Matter.Body.setPosition(rightWall, {
        x: window.innerWidth + 30,
        y: window.innerHeight / 2,
      });
      keepCanvasCrisp();
    };

    keepCanvasCrisp();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);
      render.canvas.remove();
      render.textures = {};
      container.replaceChildren();
    };
  }, [active, assets.images.logo, trigger]);

  if (!active) {
    return null;
  }

  return (
    <div
      ref={containerReference}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[55] overflow-hidden"
    />
  );
}
