import { useEffect, useRef, useState } from "react";
import { Box } from "lucide-react";

export function SharedModelThumbnail({ url, title }: { url: string; title: string }) {
  const container = useRef<HTMLSpanElement>(null);
  const [image, setImage] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let started = false;
    setImage(undefined);
    setFailed(false);
    const load = () => {
      if (started) return;
      started = true;
      void import("./shared-model-thumbnail")
        .then(({ sharedModelThumbnail }) => active ? sharedModelThumbnail(url) : undefined)
        .then((result) => { if (active) setImage(result); })
        .catch((error) => {
          if (!active) return;
          setFailed(true);
          if (import.meta.env.DEV) console.warn("[Gallery/model-thumbnail] failed", { title, error });
        });
    };
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        load();
      }
    }, { rootMargin: "100px" });
    if (container.current) observer.observe(container.current);
    return () => { active = false; observer.disconnect(); };
  }, [url, title]);
  return (
    <span className="mg-model-thumbnail" ref={container} aria-busy={!image && !failed}>
      {image ? <img src={image} alt={`3D preview of ${title}`} />
        : failed ? <Box size={24} aria-label="Preview unavailable" />
        : <small role="status">Loading…</small>}
    </span>
  );
}
