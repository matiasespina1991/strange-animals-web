import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { gameConfig } from "../lib/game-config";
import { useThreeLogoScene } from "../hooks/useThreeLogoScene";
import { SocialLinks } from "./SocialLinks";

type BrandLogoExperienceProperties = {
  easterEggActive?: boolean;
  logoPhysicsActive?: boolean;
};

const logoMinimumWidthRem = 7.8;
const logoMaximumViewportWidth = 0.5;
const initialAppearExtraDelaySeconds = 1;

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
  easterEggActive = false,
  logoPhysicsActive = false,
}: BrandLogoExperienceProperties) {
  const initialSocialRevealDoneReference = useRef(false);
  const canvasReference = useRef<HTMLCanvasElement>(null);
  const backdropReference = useRef<HTMLDivElement>(null);
  const logoResizeReference = useRef<{
    handle: HTMLDivElement;
    pointerId: number;
    startPointerX: number;
    startPointerY: number;
    startWidth: number;
  } | null>(null);
  const [logoWidthPx, setLogoWidthPx] = useState(getInitialLogoWidth);

  useThreeLogoScene({ backdropReference, canvasReference, logoWidthPx });

  useEffect(() => {
    const keepLogoWidthInBounds = () => {
      setLogoWidthPx((currentWidth) => clampLogoWidth(currentWidth));
    };

    window.addEventListener("resize", keepLogoWidthInBounds);

    return () => {
      window.removeEventListener("resize", keepLogoWidthInBounds);
    };
  }, []);

  useEffect(() => {
    initialSocialRevealDoneReference.current = true;
  }, []);

  const socialEntranceDelay = initialSocialRevealDoneReference.current
    ? 0.08
    : 2.72;

  const stopLogoResizeForPointer = (pointerId: number) => {
    const resize = logoResizeReference.current;

    if (!resize || pointerId !== resize.pointerId) {
      return;
    }

    logoResizeReference.current = null;

    if (resize.handle.hasPointerCapture(pointerId)) {
      resize.handle.releasePointerCapture(pointerId);
    }
  };

  useEffect(() => {
    const handleWindowPointerMove = (event: PointerEvent) => {
      const resize = logoResizeReference.current;

      if (!resize || event.pointerId !== resize.pointerId) {
        return;
      }

      if ((event.buttons & 1) !== 1) {
        stopLogoResizeForPointer(event.pointerId);
        return;
      }

      event.preventDefault();
      const deltaX = event.clientX - resize.startPointerX;
      const deltaY = event.clientY - resize.startPointerY;
      const diagonalDelta = (deltaX + deltaY) / 2;
      setLogoWidthPx(clampLogoWidth(resize.startWidth + diagonalDelta));
    };

    const handleWindowPointerUp = (event: PointerEvent) => {
      stopLogoResizeForPointer(event.pointerId);
    };

    const handleWindowBlur = () => {
      const resize = logoResizeReference.current;

      if (!resize) {
        return;
      }

      stopLogoResizeForPointer(resize.pointerId);
    };

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerUp);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerUp);
      window.removeEventListener("blur", handleWindowBlur);

      const resize = logoResizeReference.current;

      if (resize) {
        stopLogoResizeForPointer(resize.pointerId);
      }
    };
  }, []);

  return (
    <>
      <motion.canvas
        ref={canvasReference}
        animate={{ opacity: 1 }}
        className="pointer-events-none fixed inset-0 z-[210] size-full"
        style={{ visibility: logoPhysicsActive ? "hidden" : "visible" }}
        initial={{ opacity: 0 }}
        transition={{
          delay: 0.12 + initialAppearExtraDelaySeconds,
          duration: 1.42,
          ease: "easeOut",
        }}
      />
      <motion.div
        ref={backdropReference}
        animate={{ opacity: 1 }}
        aria-hidden="true"
        data-brand-backdrop
        data-custom-cursor
        className="fixed left-[calc(50%+var(--brand-offset-x,0px))] top-[calc(50%-var(--logo-half-height,1.35rem)-0.75rem+var(--brand-offset-y,0px))] z-[200] h-[calc(var(--logo-half-height,1.35rem)*2+1.5rem)] w-[calc(var(--logo-width,20.2rem)+2rem)] -translate-x-1/2 cursor-grab rounded-[1rem] bg-[rgba(0,0,0,0.08)] backdrop-blur-[14px]"
        style={{ visibility: logoPhysicsActive ? "hidden" : "visible" }}
        initial={{ opacity: 0 }}
        transition={{
          delay: 0.18 + initialAppearExtraDelaySeconds,
          duration: 1.28,
          ease: "easeOut",
        }}
      />
      {!logoPhysicsActive && (
        <div
          aria-hidden="true"
          className="fixed left-[calc(50%+var(--brand-offset-x,0px)+(var(--logo-width,20.2rem)/2))] top-[calc(50%+var(--brand-offset-y,0px)+var(--logo-half-height,1.35rem))] z-[220] size-5 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize bg-transparent"
          data-logo-resize-handle
          data-native-resize-cursor
          onLostPointerCapture={(event) => {
            stopLogoResizeForPointer(event.pointerId);
          }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            logoResizeReference.current = {
              handle: event.currentTarget,
              pointerId: event.pointerId,
              startPointerX: event.clientX,
              startPointerY: event.clientY,
              startWidth: logoWidthPx,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
        />
      )}
      <AnimatePresence mode="wait">
        <motion.div
          key={easterEggActive ? "social-links-corner" : "social-links-center"}
          className={[
            "pointer-events-none fixed z-[220] flex justify-center",
            easterEggActive
              ? "bottom-4 left-4 w-auto"
              : "left-1/2 top-[calc(50%+2.85rem)] w-[min(20.7rem,calc(100vw-2rem))]",
          ].join(" ")}
          initial={{
            opacity: 0,
            scale: easterEggActive ? 0.8 : 1,
            x: easterEggActive ? 0 : "-50%",
          }}
          animate={{
            opacity: 1,
            scale: easterEggActive ? 0.8 : 1,
            x: easterEggActive ? 0 : "-50%",
            transition: {
              delay: socialEntranceDelay,
              duration: initialSocialRevealDoneReference.current ? 0.28 : 0.54,
              ease: "easeOut",
            },
          }}
          exit={{
            opacity: 0,
            transition: { delay: 0.14, duration: 0.2, ease: "easeInOut" },
          }}
        >
          <SocialLinks />
        </motion.div>
      </AnimatePresence>
    </>
  );
}
