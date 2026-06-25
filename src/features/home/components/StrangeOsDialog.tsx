import {useEffect, useRef, useState, type ReactNode} from 'react';
import {AnimatePresence, motion} from 'framer-motion';

type StrangeOsDialogProperties = {
  baseTransform?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  onClose: () => void;
  onPointerLeave?: () => void;
  open: boolean;
  title?: string;
  titleClassName?: string;
};

export function StrangeOsDialog({
  baseTransform,
  children,
  className = '',
  contentClassName = '',
  onClose,
  onPointerLeave,
  open,
  title,
  titleClassName = '',
}: StrangeOsDialogProperties) {
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState({x: 0, y: 0});
  const dragReference = useRef<{
    pointerId: number;
    startPointerX: number;
    startPointerY: number;
    startPositionX: number;
    startPositionY: number;
  } | null>(null);

  useEffect(() => {
    if (!dragging) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragReference.current;

      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }

      setPosition({
        x: drag.startPositionX + event.clientX - drag.startPointerX,
        y: drag.startPositionY + event.clientY - drag.startPointerY,
      });
    };

    const handlePointerUp = (event: PointerEvent) => {
      const drag = dragReference.current;

      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }

      dragReference.current = null;
      setDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [dragging]);

  return (
    <AnimatePresence>
      {open && (
        <div
          data-custom-cursor
          className={[
            'pointer-events-auto fixed w-[min(17.6rem,calc(100vw-2rem))]',
            className,
          ].join(' ')}
          style={{
            transform: [
              baseTransform,
              `translate(${position.x}px, ${position.y}px)`,
            ]
              .filter(Boolean)
              .join(' '),
          }}
          onPointerLeave={onPointerLeave}
        >
          <motion.section
            animate={{opacity: 1, scale: 1}}
            className={[
              'relative border border-white/90 bg-black font-ubuntu-mono tracking-[0.11em] text-white text-[0.85rem]',
              contentClassName,
            ].join(' ')}
            style={{fontFamily: 'IBM3161, Ubuntu Sans Mono, monospace', letterSpacing: '0.11em'}}
            exit={{opacity: 0, scale: 0.96}}
            initial={{opacity: 0, scale: 0.96}}
            transition={{duration: 0.16, ease: 'easeOut'}}
          >
            <header
              className={[
                'flex min-h-8 select-none items-center justify-between border-b border-white/90 bg-black px-2.5 py-1.5 text-white',
                dragging ? 'cursor-grabbing' : 'cursor-grab',
              ].join(' ')}
              onPointerDown={(event) => {
                if (event.button !== 0) {
                  return;
                }

                dragReference.current = {
                  pointerId: event.pointerId,
                  startPointerX: event.clientX,
                  startPointerY: event.clientY,
                  startPositionX: position.x,
                  startPositionY: position.y,
                };
                setDragging(true);
              }}
            >
              {title ? (
                <h2
                  className={[
                    'text-[0.85rem] uppercase tracking-[0.11em]',
                    titleClassName,
                  ].join(' ')}
                >
                  {title}
                </h2>
              ) : (
                <div aria-hidden="true" />
              )}
              <button
                type="button"
                aria-label="Close dialog"
                className="flex h-6 w-6 shrink-0 items-center justify-center border border-white/90 bg-black text-[0.8rem] font-normal text-white hover:bg-white/15"
                style={{fontFamily: 'Ubuntu Sans Mono, monospace', fontWeight: 400, lineHeight: '1', transform: 'translateX(-0.05em)'}}
                onClick={(event) => {
                  event.stopPropagation();
                  onClose();
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
              >
                ×
              </button>
            </header>
            {children}
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}
