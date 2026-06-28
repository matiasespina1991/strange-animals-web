import {useEffect, useRef, useState} from 'react';
import {motion} from 'framer-motion';
import {gameConfig} from '../lib/game-config';
import {useThreeLogoScene} from '../hooks/useThreeLogoScene';
import {SocialLinks} from './SocialLinks';

type BrandLogoExperienceProperties = {
  logoPhysicsActive?: boolean;
};

const logoMinimumWidthRem = 4;
const logoMaximumViewportWidth = 0.8;

const getRootFontSize = () =>
  Number.parseFloat(getComputedStyle(document.documentElement).fontSize);

const clampLogoWidth = (width: number) => {
  const rootFontSize = getRootFontSize();
  const minimumWidth = logoMinimumWidthRem * rootFontSize;
  const maximumWidth = window.innerWidth * logoMaximumViewportWidth;

  return Math.min(Math.max(width, minimumWidth), maximumWidth);
};

const getInitialLogoWidth = () =>
  clampLogoWidth(gameConfig.logoMaxWidthRem * getRootFontSize());

export function BrandLogoExperience({
  logoPhysicsActive = false,
}: BrandLogoExperienceProperties) {
  const canvasReference = useRef<HTMLCanvasElement>(null);
  const backdropReference = useRef<HTMLDivElement>(null);
  const logoResizeReference = useRef<{
    pointerId: number;
    startPointerX: number;
    startPointerY: number;
    startWidth: number;
  } | null>(null);
  const [logoWidthPx, setLogoWidthPx] = useState(getInitialLogoWidth);

  useThreeLogoScene({backdropReference, canvasReference, logoWidthPx});

  useEffect(() => {
    const keepLogoWidthInBounds = () => {
      setLogoWidthPx((currentWidth) => clampLogoWidth(currentWidth));
    };

    window.addEventListener('resize', keepLogoWidthInBounds);

    return () => {
      window.removeEventListener('resize', keepLogoWidthInBounds);
    };
  }, []);

  const handleLogoResizePointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const resize = logoResizeReference.current;

    if (!resize || event.pointerId !== resize.pointerId) {
      return;
    }

    event.preventDefault();
    const deltaX = event.clientX - resize.startPointerX;
    const deltaY = event.clientY - resize.startPointerY;
    const diagonalDelta = (deltaX + deltaY) / 2;
    setLogoWidthPx(clampLogoWidth(resize.startWidth + diagonalDelta));
  };

  const stopLogoResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const resize = logoResizeReference.current;

    if (!resize || event.pointerId !== resize.pointerId) {
      return;
    }

    logoResizeReference.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <>
      <motion.canvas
        ref={canvasReference}
        animate={{opacity: 1}}
        className="pointer-events-none fixed inset-0 z-40 size-full"
        style={{visibility: logoPhysicsActive ? 'hidden' : 'visible'}}
        initial={{opacity: 0}}
        transition={{delay: 0.12, duration: 1.15, ease: 'easeOut'}}
      />
      <motion.div
        ref={backdropReference}
        animate={{opacity: 1}}
        aria-hidden="true"
        data-brand-backdrop
        data-custom-cursor
        className="fixed left-[calc(50%+var(--brand-offset-x,0px))] top-[calc(50%-var(--logo-half-height,1.35rem)-0.75rem+var(--brand-offset-y,0px))] z-30 h-[calc(var(--logo-half-height,1.35rem)*2+1.5rem)] w-[calc(var(--logo-width,20.2rem)+2rem)] -translate-x-1/2 cursor-grab rounded-[1rem] bg-[rgba(0,0,0,0.08)] backdrop-blur-[14px]"
        style={{visibility: logoPhysicsActive ? 'hidden' : 'visible'}}
        initial={{opacity: 0}}
        transition={{delay: 0.18, duration: 1.05, ease: 'easeOut'}}
      />
      {!logoPhysicsActive && (
        <div
          aria-hidden="true"
          className="fixed left-[calc(50%+var(--brand-offset-x,0px)+(var(--logo-width,20.2rem)/2))] top-[calc(50%+var(--brand-offset-y,0px)+var(--logo-half-height,1.35rem))] z-50 size-5 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize bg-transparent"
          data-logo-resize-handle
          data-native-resize-cursor
          onPointerCancel={stopLogoResize}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            logoResizeReference.current = {
              pointerId: event.pointerId,
              startPointerX: event.clientX,
              startPointerY: event.clientY,
              startWidth: logoWidthPx,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={handleLogoResizePointerMove}
          onPointerUp={stopLogoResize}
        />
      )}
      <div className="pointer-events-none fixed left-[calc(50%+var(--brand-offset-x,0px))] top-[calc(50%+var(--brand-offset-y,0px)+var(--logo-half-height,1.35rem)+1.5rem)] z-50 flex w-[min(calc(var(--logo-width,20.2rem)+0.5rem),calc(100vw-2rem))] -translate-x-1/2 justify-center">
        <motion.div
          animate={{opacity: 1}}
          initial={{opacity: 0}}
          transition={{delay: 0.95, duration: 1.11, ease: 'easeOut'}}
        >
          <SocialLinks />
        </motion.div>
      </div>
    </>
  );
}
