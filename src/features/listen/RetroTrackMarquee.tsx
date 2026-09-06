import { useEffect, useRef, useState } from "react";

const START_DELAY_MS = 10_000;
const CHARACTER_STEP_MS = 200;

type RetroTrackMarqueeProps = {
  className?: string;
  isPlaying: boolean;
  text: string;
};

export function RetroTrackMarquee({
  className = "",
  isPlaying,
  text,
}: RetroTrackMarqueeProps) {
  const viewportReference = useRef<HTMLSpanElement>(null);
  const characterMeasureReference = useRef<HTMLSpanElement>(null);
  const textMeasureReference = useRef<HTMLSpanElement>(null);
  const isPlayingReference = useRef(isPlaying);
  const cycleIsMovingReference = useRef(false);
  const startCycleReference = useRef<() => void>(() => {});
  const cancelPendingStartReference = useRef<() => void>(() => {});
  const [characterOffset, setCharacterOffset] = useState(0);
  const [gapCharacterCount, setGapCharacterCount] = useState(0);
  const [characterWidth, setCharacterWidth] = useState(0);

  useEffect(() => {
    const viewport = viewportReference.current;
    const characterMeasure = characterMeasureReference.current;
    const textMeasure = textMeasureReference.current;

    if (!viewport || !characterMeasure || !textMeasure) {
      return;
    }

    const updateGap = () => {
      const characterWidth = characterMeasure.getBoundingClientRect().width;
      const textWidth = textMeasure.getBoundingClientRect().width;
      const minimumGapWidth =
        Number.parseFloat(getComputedStyle(document.documentElement).fontSize) * 4;

      if (characterWidth > 0) {
        setCharacterWidth(characterWidth);
        setGapCharacterCount(
          Math.max(
            Math.ceil(minimumGapWidth / characterWidth),
            Math.ceil((viewport.clientWidth - textWidth) / characterWidth),
          ),
        );
      }
    };

    updateGap();
    const resizeObserver = new ResizeObserver(updateGap);
    resizeObserver.observe(viewport);

    return () => {
      resizeObserver.disconnect();
    };
  }, [text]);

  useEffect(() => {
    isPlayingReference.current = isPlaying;

    if (isPlaying) {
      startCycleReference.current();
    } else if (!cycleIsMovingReference.current) {
      cancelPendingStartReference.current();
    }
  }, [isPlaying]);

  useEffect(() => {
    setCharacterOffset(0);

    if (
      characterWidth === 0 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let startTimeout: number | undefined;
    let characterInterval: number | undefined;
    let cancelled = false;
    const stepsPerCycle = text.length + gapCharacterCount;

    const cancelPendingStart = () => {
      window.clearTimeout(startTimeout);
      startTimeout = undefined;
    };

    const runCycle = () => {
      if (
        cancelled ||
        !isPlayingReference.current ||
        startTimeout !== undefined ||
        characterInterval !== undefined
      ) {
        return;
      }

      startTimeout = window.setTimeout(() => {
        startTimeout = undefined;

        if (cancelled || !isPlayingReference.current) {
          return;
        }

        let step = 0;
        cycleIsMovingReference.current = true;
        characterInterval = window.setInterval(() => {
          step += 1;
          setCharacterOffset(step);

          if (step >= stepsPerCycle) {
            window.clearInterval(characterInterval);
            characterInterval = undefined;
            cycleIsMovingReference.current = false;
            setCharacterOffset(0);

            if (!cancelled && isPlayingReference.current) {
              runCycle();
            }
          }
        }, CHARACTER_STEP_MS);
      }, START_DELAY_MS);
    };

    startCycleReference.current = runCycle;
    cancelPendingStartReference.current = cancelPendingStart;
    runCycle();

    return () => {
      cancelled = true;
      cycleIsMovingReference.current = false;
      startCycleReference.current = () => {};
      cancelPendingStartReference.current = () => {};
      cancelPendingStart();
      window.clearInterval(characterInterval);
    };
  }, [characterWidth, gapCharacterCount, text]);

  const loopGap = " ".repeat(gapCharacterCount);
  const displayText = `${text}${loopGap}${text}`;

  return (
    <span
      ref={viewportReference}
      aria-label={text}
      className={`relative block overflow-hidden whitespace-nowrap ${className}`}
    >
      <span
        aria-hidden="true"
        className="inline-block whitespace-pre"
        style={{ transform: `translateX(${-characterOffset * characterWidth}px)` }}
      >
        {displayText}
      </span>
      <span
        ref={characterMeasureReference}
        aria-hidden="true"
        className="pointer-events-none absolute invisible whitespace-pre"
      >
        0
      </span>
      <span
        ref={textMeasureReference}
        aria-hidden="true"
        className="pointer-events-none absolute invisible whitespace-pre"
      >
        {text}
      </span>
    </span>
  );
}
