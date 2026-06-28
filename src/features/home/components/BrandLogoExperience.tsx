import {useRef} from 'react';
import {motion} from 'framer-motion';
import {useThreeLogoScene} from '../hooks/useThreeLogoScene';
import {SocialLinks} from './SocialLinks';

type BrandLogoExperienceProperties = {
  logoPhysicsActive?: boolean;
};

export function BrandLogoExperience({
  logoPhysicsActive = false,
}: BrandLogoExperienceProperties) {
  const canvasReference = useRef<HTMLCanvasElement>(null);
  const backdropReference = useRef<HTMLDivElement>(null);
  useThreeLogoScene({backdropReference, canvasReference});

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
        className="fixed left-[calc(50%+var(--brand-offset-x,0px))] top-[calc(50%-var(--logo-half-height,1.35rem)-0.75rem+var(--brand-offset-y,0px))] z-30 h-[calc(var(--logo-half-height,1.35rem)*2+1.5rem)] w-[min(22.2rem,calc(100vw-1rem))] -translate-x-1/2 cursor-grab rounded-[1rem] bg-[rgba(0,0,0,0.08)] backdrop-blur-[14px]"
        style={{visibility: logoPhysicsActive ? 'hidden' : 'visible'}}
        initial={{opacity: 0}}
        transition={{delay: 0.18, duration: 1.05, ease: 'easeOut'}}
      />
      <div className="pointer-events-none fixed left-1/2 top-[calc(50%+var(--logo-half-height,1.35rem)+1.5rem)] z-50 flex w-[min(20.7rem,calc(100vw-2rem))] -translate-x-1/2 justify-center">
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
