type SmoothWindowScrollOptions = {
  duration?: number;
  top: number;
};

const easeInOutCubic = (progress: number) =>
  progress < 0.5
    ? 4 * progress ** 3
    : 1 - (-2 * progress + 2) ** 3 / 2;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function smoothWindowScrollTo({
  duration,
  top,
}: SmoothWindowScrollOptions) {
  const startTop = window.scrollY;
  const distance = top - startTop;

  if (Math.abs(distance) < 1 || prefersReducedMotion()) {
    window.scrollTo(0, top);
    return () => undefined;
  }

  const animationDuration =
    duration ?? Math.min(Math.max(800, Math.abs(distance) * 0.24), 1400);
  const startTime = window.performance.now();
  let animationFrame: number | undefined;
  let cancelled = false;

  const animate = (now: number) => {
    if (cancelled) return;

    const progress = Math.min((now - startTime) / animationDuration, 1);
    window.scrollTo(0, startTop + distance * easeInOutCubic(progress));

    if (progress < 1) {
      animationFrame = window.requestAnimationFrame(animate);
    }
  };

  animationFrame = window.requestAnimationFrame(animate);

  return () => {
    cancelled = true;
    if (animationFrame !== undefined) {
      window.cancelAnimationFrame(animationFrame);
    }
  };
}
