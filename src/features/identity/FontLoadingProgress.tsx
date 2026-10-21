import { LoaderCircle } from "lucide-react";
import type { FontDownloadProgress } from "./font-download-progress";

export function FontLoadingProgress({
  progress,
  name,
  color,
}: {
  progress?: FontDownloadProgress;
  name: string;
  color: string;
}) {
  const determinate =
    progress?.phase === "downloading" && progress.total !== null;
  const percent = determinate
    ? Math.min(100, Math.floor((progress.loaded / progress.total!) * 100))
    : undefined;
  const label =
    progress?.phase === "decoding"
      ? "Preparing font…"
      : progress?.phase === "queued"
        ? "Queued…"
        : "Loading…";
  return (
    <span
      role="progressbar"
      aria-label={`${label} ${name}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={percent === undefined ? label : `${percent}% downloaded`}
      className="flex flex-col items-center gap-1.5"
      style={{ color }}
    >
      {percent === undefined ? (
        <LoaderCircle
          aria-hidden="true"
          className="size-6 animate-spin motion-reduce:animate-none"
        />
      ) : (
        <svg
          aria-hidden="true"
          className="size-7 -rotate-90"
          viewBox="0 0 28 28"
          fill="none"
        >
          <circle
            cx="14"
            cy="14"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            opacity="0.2"
          />
          <circle
            cx="14"
            cy="14"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray="100"
            strokeDashoffset={100 - percent}
            className="transition-[stroke-dashoffset] duration-100 motion-reduce:transition-none"
          />
        </svg>
      )}
      <span className="text-[0.625rem] tabular-nums">
        {percent === undefined ? label : `${percent}%`}
      </span>
    </span>
  );
}
