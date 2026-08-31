import { useEffect, useState } from "react";

type TypewriterTextProps = {
  className?: string;
  interval?: number;
  text: string;
};

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function TypewriterText({
  className,
  interval = 28,
  text,
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState(() =>
    prefersReducedMotion() ? text : "",
  );

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplayedText(text);
      return;
    }

    setDisplayedText("");
    let characterIndex = 0;
    const timer = window.setInterval(() => {
      characterIndex += 1;
      setDisplayedText(text.slice(0, characterIndex));

      if (characterIndex >= text.length) {
        window.clearInterval(timer);
      }
    }, interval);

    return () => {
      window.clearInterval(timer);
    };
  }, [interval, text]);

  return (
    <span aria-label={text} className={`relative ${className ?? ""}`}>
      <span aria-hidden="true" className="invisible">
        {text}_
      </span>
      <span aria-hidden="true" className="absolute inset-0">
        {displayedText}
        <span className="typewriter-cursor">_</span>
      </span>
    </span>
  );
}
