import {FaEnvelope, FaInstagram, FaSoundcloud} from 'react-icons/fa6';
import {socialLinks} from '@/lib/social-links';

const socialLinkClassName =
  'relative isolate inline-flex size-12 items-center justify-center text-[1.35rem] text-white transition-transform duration-500 hover:-translate-y-[3px] hover:delay-300 hover:duration-700 focus-visible:-translate-y-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white';
const glassClassName =
  'absolute inset-0 -z-10 rounded-full bg-[rgba(0,0,0,0.08)] backdrop-blur-[14px]';

export function SocialLinks() {
  return (
    <nav aria-label="Social links" className="pointer-events-auto flex gap-4">
      <a
        aria-label="SoundCloud"
        className={socialLinkClassName}
        href={socialLinks.soundcloud}
        rel="noopener noreferrer"
        target="_blank"
      >
        <span className={glassClassName} />
        <FaSoundcloud aria-hidden className="text-[1.65rem]" />
      </a>
      <a
        aria-label="Email"
        className={socialLinkClassName}
        href={socialLinks.email}
        rel="noopener noreferrer"
        target="_blank"
      >
        <span className={glassClassName} />
        <FaEnvelope aria-hidden />
      </a>
      <a
        aria-label="Instagram"
        className={socialLinkClassName}
        href={socialLinks.instagram}
        rel="noopener noreferrer"
        target="_blank"
      >
        <span className={glassClassName} />
        <FaInstagram aria-hidden />
      </a>
    </nav>
  );
}
