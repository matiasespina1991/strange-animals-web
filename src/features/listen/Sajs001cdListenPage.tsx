import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import { getDownloadURL, ref } from "firebase/storage";
import { firebaseStorage } from "@/lib/firebase";
import { sajs001cdRelease } from "./sajs001cd-release";

const formatTime = (time: number) => {
  if (!Number.isFinite(time)) {
    return "0:00";
  }

  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
};

type TrackUrlState =
  | { status: "loading"; urls: Record<string, string> }
  | { message: string; status: "error"; urls: Record<string, string> }
  | { status: "ready"; urls: Record<string, string> };

export function Sajs001cdListenPage() {
  const audioReference = useRef<HTMLAudioElement>(null);
  const [trackUrlState, setTrackUrlState] = useState<TrackUrlState>({
    status: "loading",
    urls: {},
  });
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.82);
  const currentTrack = sajs001cdRelease.tracks[currentTrackIndex];
  const currentTrackUrl = trackUrlState.urls[currentTrack.slug];
  const isFirstTrack = currentTrackIndex === 0;
  const isLastTrack = currentTrackIndex === sajs001cdRelease.tracks.length - 1;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  useEffect(() => {
    let cancelled = false;

    async function loadTrackUrls() {
      try {
        const entries = await Promise.all(
          sajs001cdRelease.tracks.map(async (track) => [
            track.slug,
            await getDownloadURL(ref(firebaseStorage, track.storagePath)),
          ]),
        );

        if (!cancelled) {
          setTrackUrlState({
            status: "ready",
            urls: Object.fromEntries(entries),
          });
        }
      } catch (error) {
        if (!cancelled) {
          setTrackUrlState({
            message:
              error instanceof Error
                ? error.message
                : "Could not load the release audio.",
            status: "error",
            urls: {},
          });
        }
      }
    }

    void loadTrackUrls();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const audio = audioReference.current;

    if (!audio) {
      return;
    }

    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioReference.current;

    if (!audio || !currentTrackUrl || !isPlaying) {
      return;
    }

    void audio.play().catch(() => {
      setIsPlaying(false);
    });
  }, [currentTrackUrl, isPlaying]);

  const playCurrentTrack = useCallback(() => {
    const audio = audioReference.current;

    if (!audio || !currentTrackUrl) {
      return;
    }

    setIsPlaying(true);
    void audio.play().catch(() => {
      setIsPlaying(false);
    });
  }, [currentTrackUrl]);

  const pauseCurrentTrack = useCallback(() => {
    audioReference.current?.pause();
    setIsPlaying(false);
  }, []);

  const selectTrack = (index: number) => {
    setCurrentTrackIndex(index);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(true);
  };

  const goToPreviousTrack = () => {
    setCurrentTrackIndex((index) => Math.max(0, index - 1));
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(true);
  };

  const goToNextTrack = useCallback(() => {
    setCurrentTrackIndex((index) =>
      Math.min(sajs001cdRelease.tracks.length - 1, index + 1),
    );
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(true);
  }, []);

  const handleEnded = () => {
    if (isLastTrack) {
      setIsPlaying(false);
      setCurrentTime(0);
      return;
    }

    goToNextTrack();
  };

  const seekToPointerPosition = (element: HTMLElement, clientX: number) => {
    if (!duration || !audioReference.current) {
      return;
    }

    const rect = element.getBoundingClientRect();
    const nextProgress = Math.min(
      1,
      Math.max(0, (clientX - rect.left) / rect.width),
    );
    const nextTime = nextProgress * duration;

    audioReference.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const activeTrackLabel = useMemo(
    () =>
      `${currentTrack.number.toString().padStart(2, "0")} / ${currentTrack.artist} - ${currentTrack.title}`,
    [currentTrack],
  );

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-5 font-mono text-white sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl flex-col justify-center">
        <div className="grid gap-4 lg:grid-cols-[minmax(16rem,calc(43%-5rem))_1fr] lg:items-stretch">
          <div className="flex min-h-[31rem] flex-col justify-between border border-white/70 bg-black p-4 shadow-[5px_5px_0_0_rgba(255,255,255,0.75)] sm:p-5">
            <div>
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.11em] text-white/55">
                {sajs001cdRelease.catalogue}
              </p>
              <h1 className="mt-4 max-w-[10ch] font-mono text-5xl uppercase leading-[0.9] tracking-normal text-white sm:text-6xl">
                {sajs001cdRelease.title}
              </h1>
              <img
                alt="SAJS001CD Odyssey cover"
                className="mx-auto mt-6 aspect-square w-full max-w-[12.6rem] border border-white/45 object-cover xl:max-w-[18rem]"
                src="/media/images/releases/sajs001/cover.png"
              />
              <p className="mt-4 max-w-sm text-sm leading-6 text-white/64">
                (this is a liquid drum n bass/jungle compilation, not a full
                album) Strange Animals presents Odyssey, a compilation album
                consisting of a selection of tracks from various artists,
                showcasing diverse and innovative sounds inspired by liquid drum
                n bass/jungle.
              </p>
            </div>
          </div>

          <div className="flex min-h-[31rem] flex-col border border-white/70 bg-black shadow-[5px_5px_0_0_rgba(255,255,255,0.75)]">
            <div className="border-b border-white/35 px-3 py-3 sm:px-4">
              <div className="mb-4 border border-white/35 bg-white/[0.03] p-3">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.1em] text-white/45">
                  Now Playing
                </p>
                <p className="mt-2 min-h-12 font-mono text-lg leading-tight text-white">
                  {activeTrackLabel}
                </p>
                <button
                  type="button"
                  aria-label="Seek playback"
                  className="mt-4 block h-2 w-full cursor-pointer border border-white/45 bg-black p-0 text-left focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!duration}
                  onClick={(event) => {
                    seekToPointerPosition(event.currentTarget, event.clientX);
                  }}
                  onPointerDown={(event) => {
                    seekToPointerPosition(event.currentTarget, event.clientX);
                  }}
                >
                  <div
                    className="h-full bg-white"
                    style={{ width: `${progress}%` }}
                  />
                </button>
                <div className="mt-2 flex justify-between font-mono text-[0.72rem] text-white/55">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-label="Previous track"
                  className="flex size-10 items-center justify-center border border-white/70 bg-black text-white/90 shadow-[2px_2px_0_0_rgba(255,255,255,0.7)] transition-[transform,box-shadow,color] duration-150 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none focus:outline-none focus:ring-2 focus:ring-white/80 disabled:cursor-not-allowed disabled:opacity-35"
                  disabled={isFirstTrack || trackUrlState.status !== "ready"}
                  onClick={goToPreviousTrack}
                >
                  <SkipBack className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={isPlaying ? "Pause" : "Play"}
                  className="flex size-10 items-center justify-center border border-white/80 bg-white text-black shadow-[2px_2px_0_0_rgba(255,255,255,0.7)] transition-[transform,box-shadow,background-color] duration-150 hover:translate-x-0.5 hover:translate-y-0.5 hover:bg-white/90 hover:shadow-none focus:outline-none focus:ring-2 focus:ring-white/80 disabled:cursor-not-allowed disabled:opacity-35"
                  disabled={trackUrlState.status !== "ready"}
                  onClick={isPlaying ? pauseCurrentTrack : playCurrentTrack}
                >
                  {isPlaying ? (
                    <Pause className="size-4" />
                  ) : (
                    <Play className="size-4" />
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Next track"
                  className="flex size-10 items-center justify-center border border-white/70 bg-black text-white/90 shadow-[2px_2px_0_0_rgba(255,255,255,0.7)] transition-[transform,box-shadow,color] duration-150 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none focus:outline-none focus:ring-2 focus:ring-white/80 disabled:cursor-not-allowed disabled:opacity-35"
                  disabled={isLastTrack || trackUrlState.status !== "ready"}
                  onClick={goToNextTrack}
                >
                  <SkipForward className="size-4" />
                </button>

                <label className="ml-auto flex min-w-[9rem] items-center gap-2 text-white/65">
                  <Volume2 className="size-4" />
                  <span className="sr-only">Volume</span>
                  <input
                    className="h-1 w-full accent-white"
                    max="1"
                    min="0"
                    step="0.01"
                    type="range"
                    value={volume}
                    onChange={(event) => {
                      setVolume(Number(event.target.value));
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {trackUrlState.status === "loading" ? (
                <div className="flex h-full min-h-[18rem] items-center justify-center gap-3 font-mono text-sm uppercase tracking-[0.08em] text-white/60">
                  <Loader2 className="size-4 animate-spin" />
                  Loading WAVs
                </div>
              ) : null}

              {trackUrlState.status === "error" ? (
                <div className="flex h-full min-h-[18rem] items-center justify-center gap-3 px-6 text-sm text-white/70">
                  <AlertTriangle className="size-5 shrink-0" />
                  <span>{trackUrlState.message}</span>
                </div>
              ) : null}

              {trackUrlState.status === "ready" ? (
                <ol className="divide-y divide-white/20">
                  {sajs001cdRelease.tracks.map((track, index) => {
                    const selected = index === currentTrackIndex;

                    return (
                      <li key={track.slug}>
                        <button
                          type="button"
                          className={[
                            "grid w-full cursor-pointer grid-cols-[2.6rem_1fr_3.5rem] items-center gap-3 px-3 py-2 text-left transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white/80 sm:grid-cols-[3rem_1fr_4rem] sm:px-4",
                            selected
                              ? "bg-white/72 text-black"
                              : "bg-black text-white/82 hover:bg-white/[0.12]",
                          ].join(" ")}
                          onClick={() => {
                            selectTrack(index);
                          }}
                        >
                          <span className="font-mono text-sm tabular-nums opacity-70">
                            {track.number.toString().padStart(2, "0")}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-mono text-sm uppercase tracking-[0.04em]">
                              {track.title}
                            </span>
                            <span
                              className={[
                                "mt-0.5 block truncate text-[0.7825rem] font-semibold",
                                selected ? "text-black/68" : "text-white/48",
                              ].join(" ")}
                            >
                              {track.artist}
                            </span>
                          </span>
                          <span className="text-right text-xs tabular-nums opacity-60">
                            {track.durationLabel}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : null}
            </div>

            <audio
              ref={audioReference}
              preload="metadata"
              src={currentTrackUrl}
              onDurationChange={(event) => {
                setDuration(event.currentTarget.duration);
              }}
              onEnded={handleEnded}
              onPause={() => {
                setIsPlaying(false);
              }}
              onPlaying={() => {
                setIsPlaying(true);
              }}
              onTimeUpdate={(event) => {
                setCurrentTime(event.currentTarget.currentTime);
              }}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
