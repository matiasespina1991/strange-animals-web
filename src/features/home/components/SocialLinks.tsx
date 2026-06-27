import { motion } from "framer-motion";
import { FaEnvelope, FaInstagram, FaSoundcloud } from "react-icons/fa6";
import { socialLinks } from "@/lib/social-links";

const socialLinkClassName =
  "group relative isolate inline-flex size-12 items-center justify-center overflow-hidden rounded-full text-[1.35rem] text-white/88 transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white";
const glassClassName =
  "absolute inset-0 -z-20 rounded-full bg-[rgba(0,0,0,0.08)] backdrop-blur-[14px]";

const hoverMotion = {
  whileHover: {
    y: 0.6,
    transition: { duration: 0.95, ease: [0.2, 0.02, 0.12, 1] },
  },
  defaultTransition: { duration: 0.82, ease: [0.2, 0.02, 0.12, 1] },
};

const linkOverlayClassName =
  "pointer-events-none absolute inset-0 -z-10 rounded-full opacity-0 scale-[0.18] -translate-x-2 -translate-y-2 transition-[transform,opacity] duration-[950ms] ease-[cubic-bezier(0.2,0.02,0.12,1)] group-hover:opacity-100 group-hover:scale-100 group-hover:translate-x-0 group-hover:translate-y-0";

const socialItems = [
  {
    label: "SoundCloud",
    href: socialLinks.soundcloud,
    icon: <FaSoundcloud aria-hidden className="text-[1.65rem]" />,
    overlay:
      "bg-[linear-gradient(135deg,rgba(255,122,0,0.98)_0%,rgba(255,94,0,0.92)_40%,rgba(255,145,77,0.85)_100%)]",
  },
  {
    label: "Email",
    href: socialLinks.email,
    icon: <FaEnvelope aria-hidden className="text-[1.22rem]" />,
    overlay:
      "bg-[linear-gradient(135deg,rgba(86,180,255,0.98)_0%,rgba(36,129,255,0.9)_52%,rgba(125,214,255,0.82)_100%)]",
  },
  {
    label: "Instagram",
    href: socialLinks.instagram,
    icon: <FaInstagram aria-hidden />,
    overlay:
      "bg-[linear-gradient(135deg,rgba(131,58,180,0.96)_0%,rgba(225,48,108,0.92)_45%,rgba(253,29,29,0.9)_68%,rgba(245,96,64,0.88)_82%,rgba(252,175,69,0.84)_100%)]",
  },
] as const;

export function SocialLinks() {
  return (
    <nav
      aria-label="Social links"
      data-custom-cursor
      className="pointer-events-auto flex gap-4"
    >
      {socialItems.map((item) => (
        <motion.a
          key={item.label}
          aria-label={item.label}
          className={socialLinkClassName}
          href={item.href}
          rel="noopener noreferrer"
          target="_blank"
          initial={{ y: 0 }}
          transition={hoverMotion.defaultTransition}
          whileHover={hoverMotion.whileHover}
        >
          <span className={glassClassName} />
          <span
            aria-hidden="true"
            className={[linkOverlayClassName, item.overlay].join(" ")}
            style={{ transformOrigin: "top left" }}
          />
          <span className="relative z-10 transition-colors duration-300 group-hover:text-white">
            {item.icon}
          </span>
        </motion.a>
      ))}
    </nav>
  );
}
