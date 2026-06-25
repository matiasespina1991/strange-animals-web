import {motion} from 'framer-motion';
import {FaEnvelope, FaInstagram, FaSoundcloud} from 'react-icons/fa6';
import {socialLinks} from '@/lib/social-links';

const socialLinkClassName =
  'relative isolate inline-flex size-12 items-center justify-center text-[1.35rem] text-white transition-colors duration-150 hover:text-white/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white';
const glassClassName =
  'absolute inset-0 -z-10 rounded-full bg-[rgba(0,0,0,0.08)] backdrop-blur-[14px]';

const hoverMotion = {
  whileHover: {
    y: 1.2,
    transition: {delay: 0.18, duration: 0.7, ease: [0.24, 0, 0.36, 1]},
  },
  defaultTransition: {duration: 0.5, ease: [0.24, 0, 0.36, 1]},
};

export function SocialLinks() {
  return (
    <nav aria-label="Social links" data-custom-cursor className="pointer-events-auto flex gap-4">
      <motion.a
        aria-label="SoundCloud"
        className={socialLinkClassName}
        href={socialLinks.soundcloud}
        rel="noopener noreferrer"
        target="_blank"
        initial={{y: 0}}
        transition={hoverMotion.defaultTransition}
        whileHover={hoverMotion.whileHover}
      >
        <span className={glassClassName} />
        <FaSoundcloud aria-hidden className="text-[1.65rem]" />
      </motion.a>
      <motion.a
        aria-label="Email"
        className={socialLinkClassName}
        href={socialLinks.email}
        rel="noopener noreferrer"
        target="_blank"
        transition={hoverMotion.defaultTransition}
        whileHover={hoverMotion.whileHover}
      >
        <span className={glassClassName} />
        <FaEnvelope aria-hidden className="text-[1.22rem]" />
      </motion.a>
      <motion.a
        aria-label="Instagram"
        className={socialLinkClassName}
        href={socialLinks.instagram}
        rel="noopener noreferrer"
        target="_blank"
        transition={hoverMotion.defaultTransition}
        whileHover={hoverMotion.whileHover}
      >
        <span className={glassClassName} />
        <FaInstagram aria-hidden />
      </motion.a>
    </nav>
  );
}
