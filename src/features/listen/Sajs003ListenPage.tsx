import { useCallback, useEffect, useRef, useState } from "react";
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
import { sajs003Release } from "./sajs003-release";

const SAJS003_COVER_PATH = "/media/images/releases/sajs003/cover.png";

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

export function Sajs003ListenPage() {
  const audioReference = useRef<HTMLAudioElement>(null);
  const [trackUrlState, setTrackUrlState] = useState<TrackUrlState>({
    status: "loading",
    urls: {},
  });
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCoverLightboxOpen, setIsCoverLightboxOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const currentTrack = sajs003Release.tracks[currentTrackIndex];
  const currentTrackUrl = trackUrlState.urls[currentTrack.slug];
  const isFirstTrack = currentTrackIndex === 0;
  const isLastTrack = currentTrackIndex === sajs003Release.tracks.length - 1;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  useEffect(() => {
    let cancelled = false;

    async function loadTrackUrls() {
      try {
        const entries = await Promise.all(
          sajs003Release.tracks.map(async (track) => [
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
      Math.min(sajs003Release.tracks.length - 1, index + 1),
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

  useEffect(() => {
    if (!isCoverLightboxOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsCoverLightboxOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isCoverLightboxOpen]);

  useEffect(() => {
    if (!isCoverLightboxOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCoverLightboxOpen]);

  useEffect(() => {
    if (
      !("mediaSession" in navigator) ||
      typeof MediaMetadata === "undefined"
    ) {
      return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: `${sajs003Release.title} (${sajs003Release.catalogue})`,
      artwork: [
        {
          src: SAJS003_COVER_PATH,
          sizes: "512x512",
          type: "image/png",
        },
      ],
    });

    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

    const setActionHandler = (
      action: MediaSessionAction,
      handler: MediaSessionActionHandler | null,
    ) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Some actions are not supported by all browsers/platforms.
      }
    };

    setActionHandler("play", () => {
      playCurrentTrack();
    });

    setActionHandler("pause", () => {
      pauseCurrentTrack();
    });

    setActionHandler("previoustrack", () => {
      goToPreviousTrack();
    });

    setActionHandler("nexttrack", () => {
      goToNextTrack();
    });

    setActionHandler("seekto", (details) => {
      if (typeof details.seekTime !== "number" || !audioReference.current) {
        return;
      }

      const maxDuration =
        Number.isFinite(audioReference.current.duration) &&
        audioReference.current.duration > 0
          ? audioReference.current.duration
          : duration;
      const nextTime = Math.min(maxDuration, Math.max(0, details.seekTime));

      audioReference.current.currentTime = nextTime;
      setCurrentTime(nextTime);
    });

    return () => {
      setActionHandler("play", null);
      setActionHandler("pause", null);
      setActionHandler("previoustrack", null);
      setActionHandler("nexttrack", null);
      setActionHandler("seekto", null);
    };
  }, [
    currentTrack.artist,
    currentTrack.title,
    duration,
    goToNextTrack,
    isPlaying,
    pauseCurrentTrack,
    playCurrentTrack,
  ]);

  return (
    <main className="listen-page-amiga min-h-screen bg-[#050505] pr-3 pl-2 py-4 text-[0.96rem] text-white sm:px-6 md:text-[0.8rem] lg:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl flex-col justify-center">
        <div className="grid gap-4 lg:grid-cols-[minmax(16rem,calc(43%-5rem))_1fr] lg:items-stretch">
          <div className="flex min-h-0 flex-col justify-between bg-black p-4 sm:p-5 lg:min-h-[31rem]">
            <div>
              <p className="font-mono text-[0.73rem] uppercase tracking-[0.066em] text-white/60 md:text-[0.75rem]">
                <a href="/" className="hover:text-white/80">
                  Strange Animals
                </a>{" "}
                &gt; Jungle Series &gt; {sajs003Release.catalogue}
              </p>
              <h1 className="mt-[0.65rem] font-mono text-[1.8rem] uppercase leading-[0.9] tracking-[-0.008em] text-white sm:text-[1.7rem]">
                V.A. Jazz Licks Vol. 1 (Vinyl Only)
              </h1>
              <div className="mt-6 flex flex-col gap-4 min-[715px]:max-[1023px]:flex-row min-[715px]:max-[1023px]:items-start">
                <button
                  type="button"
                  aria-label="Open album cover"
                  className="w-full max-w-[12.6rem] shrink-0 border border-white/15 bg-black p-0 text-left"
                  onClick={() => {
                    setIsCoverLightboxOpen(true);
                  }}
                >
                  <img
                    alt="SAJS003 Jazz Licks Vol. 1 cover"
                    className="aspect-square w-full object-cover"
                    src={SAJS003_COVER_PATH}
                  />
                </button>
                <p
                  className="max-w-sm text-[1.2rem] 
                  
                  leading-[1.9rem] 
                md:leading-[1.3rem] tracking-[-0.008em] text-white/64 
                md:text-[0.89rem]"
                >
                  Strange Animals presents Jazz Licks Vol. 1, a compilation
                  release exploring jazz-infused jungle and drum n bass beats
                  from producers around the world.
                  <span className="mt-3 block">Release date: TBA 2027</span>
                  <span className="mt-3 block">Format: Vinyl only</span>
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 flex min-h-0 max-h-[calc(100vh-3.2rem)] flex-col overflow-hidden border-[0.5px] border-white/50 bg-black ring-inset ring-white/20 md:shadow-[2.4px_2.4px_0_0_rgba(255,255,255,0.45)]">
            <div className="border-b border-white/25 p-2.5">
              <div className="border border-white/30 bg-white/[0.03] p-2.5">
                <p className="font-mono text-[0.803rem] uppercase tracking-[0.06em] text-white/45 md:text-[0.669rem]">
                  Now Playing
                </p>
                <p className="mt-1.5 min-h-[2.4rem] font-mono text-[1.0175rem] leading-tight tracking-[-0.008em] text-white md:text-[0.9rem]">
                  <span className="tabular-nums text-[1.1675rem] md:text-[1.025rem]">
                    {currentTrack.number.toString().padStart(2, "0")} /
                  </span>{" "}
                  {currentTrack.artist} - {currentTrack.title}
                </p>
                <button
                  type="button"
                  aria-label="Seek playback"
                  className="mt-3 block h-2 w-full cursor-pointer border border-white/40 bg-black p-0 text-left focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
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
                <div className="mt-2 flex justify-between font-mono text-[0.691rem] text-white/55 md:text-[0.576rem]">
                  <span className="tabular-nums text-[0.841rem] md:text-[0.701rem]">
                    {formatTime(currentTime)}
                  </span>
                  <span className="tabular-nums text-[0.841rem] md:text-[0.701rem]">
                    {formatTime(duration)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/20 pt-2">
                  <button
                    type="button"
                    aria-label="Previous track"
                    className="flex size-11 items-center justify-center border border-white/70 bg-black text-white/90 shadow-[2px_2px_0_0_rgba(255,255,255,0.7)] transition-[transform,box-shadow,color] duration-150 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-35 md:size-9 md:hover:translate-x-0.5 md:hover:translate-y-0.5 md:hover:shadow-none"
                    disabled={isFirstTrack || trackUrlState.status !== "ready"}
                    onClick={goToPreviousTrack}
                  >
                    <SkipBack className="size-4 md:size-[0.82rem]" />
                  </button>
                  <button
                    type="button"
                    aria-label={isPlaying ? "Pause" : "Play"}
                    className={[
                      "flex size-11 items-center justify-center border border-white/80 transition-[transform,box-shadow,background-color,color] duration-150 active:translate-x-0.5 active:translate-y-0.5 focus:outline-none disabled:cursor-not-allowed disabled:opacity-35 md:size-9 md:hover:translate-x-0.5 md:hover:translate-y-0.5",
                      isPlaying
                        ? "translate-x-px translate-y-px bg-white text-black shadow-none"
                        : "bg-black text-white shadow-[2px_2px_0_0_rgba(255,255,255,0.7)] active:shadow-none md:hover:shadow-none",
                    ].join(" ")}
                    disabled={trackUrlState.status !== "ready"}
                    onClick={isPlaying ? pauseCurrentTrack : playCurrentTrack}
                  >
                    {isPlaying ? (
                      <Pause className="size-4 md:size-[0.82rem]" />
                    ) : (
                      <Play className="size-4 fill-current md:size-[0.82rem]" />
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label="Next track"
                    className="flex size-11 items-center justify-center border border-white/70 bg-black text-white/90 shadow-[2px_2px_0_0_rgba(255,255,255,0.7)] transition-[transform,box-shadow,color] duration-150 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-35 md:size-9 md:hover:translate-x-0.5 md:hover:translate-y-0.5 md:hover:shadow-none"
                    disabled={isLastTrack || trackUrlState.status !== "ready"}
                    onClick={goToNextTrack}
                  >
                    <SkipForward className="size-4 md:size-[0.82rem]" />
                  </button>

                  <label className="ml-auto flex min-w-[9rem] items-center gap-2 text-white/65">
                    <Volume2 className="size-4" />
                    <span className="sr-only">Volume</span>
                    <input
                      className="listen-volume-slider h-1 w-full"
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
            </div>

            <div className="listen-playlist-scrollbar min-h-0 flex-1 overflow-y-auto">
              {trackUrlState.status === "loading" ? (
                <div className="flex h-full min-h-[18rem] items-center justify-center gap-3 font-mono text-[0.84rem] uppercase tracking-[0.048em] text-white/60 md:text-[0.7rem]">
                  <Loader2 className="size-4 animate-spin" />
                  Loading Audio
                </div>
              ) : null}

              {trackUrlState.status === "error" ? (
                <div className="flex h-full min-h-[18rem] items-center justify-center gap-3 px-6 text-[0.84rem] text-white/70 md:text-[0.7rem]">
                  <AlertTriangle className="size-5 shrink-0" />
                  <span>{trackUrlState.message}</span>
                </div>
              ) : null}

              {trackUrlState.status === "ready" ? (
                <ol className="divide-y divide-white/15">
                  {sajs003Release.tracks.map((track, index) => {
                    const selected = index === currentTrackIndex;

                    return (
                      <li key={track.slug}>
                        <button
                          type="button"
                          className={[
                            "grid w-full cursor-pointer grid-cols-[2.6rem_1fr_3.5rem] items-center gap-3 px-3 py-1.5 text-left transition-colors duration-200 focus:outline-none focus-visible:ring-white/80 sm:grid-cols-[3rem_1fr_4rem] sm:px-4",
                            selected
                              ? "bg-white/[0.68] text-black"
                              : "bg-black text-white/82 hover:bg-white/[0.12]",
                          ].join(" ")}
                          onClick={() => {
                            selectTrack(index);
                          }}
                        >
                          <span className="font-mono text-[0.915rem] tabular-nums opacity-70 md:text-[0.7625rem]">
                            {track.number.toString().padStart(2, "0")}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-mono text-[0.908rem] uppercase tracking-[0.024em] md:text-[0.7625rem]">
                              {track.title}
                            </span>
                            <span
                              className={[
                                "mt-0.5 block truncate text-[0.901rem] font-semibold md:text-[0.751rem]",
                                selected ? "text-black/68" : "text-white/48",
                              ].join(" ")}
                            >
                              {track.artist}
                            </span>
                          </span>
                          <span className="text-right text-[0.87rem] tabular-nums opacity-60 md:text-[0.725rem]">
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

      {isCoverLightboxOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 sm:px-8 sm:py-10"
          role="dialog"
          aria-modal="true"
          aria-label="Album cover preview"
          onClick={() => {
            setIsCoverLightboxOpen(false);
          }}
        >
          <div
            className="relative"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <button
              type="button"
              aria-label="Close album cover preview"
              className="absolute top-2 -right-12 z-10 flex h-6 w-6 items-center justify-center border border-[#d1d1d1cc] bg-black text-white/90 shadow-[1px_1px_0_0_rgba(255,255,255,0.78)] transition-[transform,box-shadow] duration-100 ease-out hover:translate-x-px hover:translate-y-px hover:shadow-[0_0_0_0_rgba(255,255,255,0)] active:translate-x-px active:translate-y-px active:shadow-[0_0_0_0_rgba(255,255,255,0)] sm:-right-14"
              onClick={() => {
                setIsCoverLightboxOpen(false);
              }}
            >
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 h-[2px] w-[0.72rem] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-current"
              />
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 h-[2px] w-[0.72rem] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-current"
              />
            </button>
            <img
              alt="SAJS003 Jazz Licks Vol. 1 cover preview"
              className="max-h-[calc(100vh-4rem)] w-auto max-w-[calc(100vw-2rem)] object-contain"
              src={SAJS003_COVER_PATH}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}
