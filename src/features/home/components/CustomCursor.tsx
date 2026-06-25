import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export function CustomCursor() {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const smoothX = useSpring(x, { damping: 18, stiffness: 650, mass: 0.18 });
  const smoothY = useSpring(y, { damping: 18, stiffness: 650, mass: 0.18 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const supportsScrollbar = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return false;
      }

      for (
        let el: Element | null = target;
        el instanceof Element;
        el = el.parentElement
      ) {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        const hasVerticalScrollbar =
          (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          el.scrollHeight > el.clientHeight;

        if (hasVerticalScrollbar) {
          const scrollbarWidth = rect.width - el.clientWidth;
          const threshold = Math.max(scrollbarWidth, 10);

          if (
            event.clientX >= rect.right - threshold &&
            event.clientX <= rect.right
          ) {
            return true;
          }
        }

        const hasHorizontalScrollbar =
          (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
          el.scrollWidth > el.clientWidth;

        if (hasHorizontalScrollbar) {
          const scrollbarHeight = rect.height - el.clientHeight;
          const threshold = Math.max(scrollbarHeight, 10);

          if (
            event.clientY >= rect.bottom - threshold &&
            event.clientY <= rect.bottom
          ) {
            return true;
          }
        }
      }

      const root = document.documentElement;
      if (window.innerWidth > root.clientWidth && event.clientX >= root.clientWidth) {
        return true;
      }
      if (
        window.innerHeight > root.clientHeight &&
        event.clientY >= root.clientHeight
      ) {
        return true;
      }

      return false;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        setVisible(false);
        return;
      }

      const target = event.target;

      if (
        target instanceof Element &&
        target.closest(
          "#webamp, #webamp-context-menu, [data-native-resize-cursor]",
        )
      ) {
        setVisible(false);
        return;
      }

      if (supportsScrollbar(event)) {
        setVisible(false);
        return;
      }

      x.set(event.clientX);
      y.set(event.clientY);
      setVisible(true);
    };

    const handlePointerLeave = () => {
      setVisible(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("blur", handlePointerLeave);
    document.addEventListener("mouseleave", handlePointerLeave);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("blur", handlePointerLeave);
      document.removeEventListener("mouseleave", handlePointerLeave);
    };
  }, [x, y]);

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[999] hidden sm:block"
      animate={{ opacity: visible ? 1 : 0 }}
      style={{ x: smoothX, y: smoothY }}
      transition={{ duration: 0.06, ease: "easeOut" }}
    >
      <svg
        aria-hidden="true"
        className="-translate-x-1/2 drop-shadow-[0_0_4px_rgba(255,255,255,0.18)]"
        style={{transform: 'translate(-50%, calc(-50% + 0.9rem)) rotate(22deg)'}}
        fill="none"
        height="22"
        viewBox="0 0 24 24"
        width="22"
      >
        <path
          d="M5.4 3.7L19.2 11.6L12.8 14.1L10.4 20.7L5.4 3.7Z"
          fill="white"
          stroke="rgb(120 120 120 / 0.72)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.15"
        />
      </svg>
    </motion.div>
  );
}
