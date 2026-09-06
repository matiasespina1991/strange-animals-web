import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import { getDownloadURL, ref } from "firebase/storage";
import { firebaseStorage } from "@/lib/firebase";
import { sajs001cdRelease } from "./sajs001cd-release";
import { RetroTrackMarquee } from "./RetroTrackMarquee";
import {
  ReleasePageLoadingSkeleton,
  ReleasePlaylistSkeleton,
  useReleaseFontsReady,
} from "./release-loading";

const SAJS001CD_COVER_PATH = "/media/images/releases/sajs001/cover.png";

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

type Sajs001ReleasePageProps = {
  catalogue: string;
  edition: string;
  format: string;
};

export function Sajs001cdListenPage() {
  return (
    <Sajs001ReleasePage
      catalogue="SAJS001CD"
      edition="CD"
      format="CD + Vinyl sampler"
    />
  );
}

export function Sajs001ListenPage() {
  return (
    <Sajs001ReleasePage
      catalogue="SAJS001"
      edition="Vinyl"
      format="2 x Vinyl"
    />
  );
}

function Sajs001ReleasePage({
  catalogue,
  edition,
  format,
}: Sajs001ReleasePageProps) {
  const releaseFontsReady = useReleaseFontsReady();
  const audioReference = useRef<HTMLAudioElement>(null);
  const [trackUrlState, setTrackUrlState] = useState<TrackUrlState>({
    status: "loading",
    urls: {},
  });
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStartedPlayback, setHasStartedPlayback] = useState(false);
  const [isCoverLightboxOpen, setIsCoverLightboxOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
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
    if (index === currentTrackIndex) {
      const audio = audioReference.current;

      if (!audio || !currentTrackUrl) {
        return;
      }

      audio.currentTime = 0;
      setCurrentTime(0);
      setIsPlaying(true);
      void audio.play().catch(() => {
        setIsPlaying(false);
      });
      return;
    }

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
      album: `${sajs001cdRelease.title} (${catalogue})`,
      artwork: [
        {
          src: SAJS001CD_COVER_PATH,
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

  if (!releaseFontsReady) {
    return <ReleasePageLoadingSkeleton />;
  }

  return (
    <main className="listen-page-amiga min-h-screen bg-[#050505] pr-3 pl-2 py-4 text-[0.96rem] text-white sm:px-6 md:text-[0.8rem] lg:px-8">
      <section className="mx-auto flex pb-40 min-h-[calc(100vh-2.5rem)] max-w-6xl flex-col justify-center">
        <div className="grid gap-4 lg:grid-cols-[minmax(16rem,calc(48%-5rem))_1fr] lg:items-stretch">
          <div className="flex min-h-0 flex-col justify-between bg-black p-4 sm:p-5 lg:min-h-[31rem]">
            <div>
              <p className="font-mono text-[0.73rem] uppercase tracking-[0.066em] text-white/60 md:text-[0.75rem]">
                <a href="/" className="hover:text-white/80">
                  Strange Animals
                </a>{" "}
                &gt; Jungle Series &gt; {catalogue}
              </p>
              <div className="mt-[0.52rem] flex flex-col items-start gap-[0.7rem]">
                <span className="border border-white/25 px-1.5 pb-[0.075rem] pt-[0.1rem] font-mono text-[0.58rem] uppercase leading-none tracking-[0.08em] text-white/55">
                  Out soon
                </span>
                <h1 className="release-title font-microgramma text-[1.8rem] font-medium uppercase leading-[0.9] tracking-[0.05em] text-white sm:text-[1.3rem] md:leading-[1.2]">
                  V.A. Odyssey Vol. I ({edition})
                </h1>
              </div>
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
                    alt={`${catalogue} Odyssey cover`}
                    className="aspect-square w-full object-cover"
                    src={SAJS001CD_COVER_PATH}
                  />
                </button>
                <p className="max-w-sm tracking-[-0.1px] text-[1.1rem] leading-[1.8rem] text-white/64 md:text-[0.89rem] md:leading-[1.3rem]">
                  Strange Animals presents Odyssey Vol. I, a compilation album
                  consisting of a selection of tracks from a variety of artists
                  from all over the world, showcasing a wide spectrum of sounds
                  inspired by liquid drum n bass/jungle.
                  <span className="mt-3 block">
                    All tracks mastered by{" "}
                    <a
                      href="https://www.discogs.com/artist/499136-Beau-Thomas"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-blue-400 hover:text-blue-300 hover:underline hover:underline-offset-2"
                    >
                      Beau Thomas
                    </a>{" "}
                    at Ten Eight Seven Mastering, London, UK.
                  </span>
                  <span className="mt-3 block">
                    Original artwork by{" "}
                    <a
                      href="https://laurabutallo.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-blue-400 hover:text-blue-300 hover:underline hover:underline-offset-2"
                    >
                      Laura Butallo
                    </a>
                    .
                  </span>
                  <span className="mt-3 block">
                    Release date:{" "}
                    <strong className="font-semibold">TBA 2026</strong>
                  </span>
                  <span className="mt-3 block">Catalog #: {catalogue}</span>
                  <span className="mt-3 block">
                    Format: <strong className="font-semibold">{format}</strong>
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className="listen-player mt-3 flex min-h-0 max-h-[calc(100vh-5.5rem)] flex-col overflow-hidden border-[0.5px] border-white/50 bg-black ring-inset ring-white/20 md:shadow-[2.4px_2.4px_0_0_rgba(255,255,255,0.45)] lg:mt-12">
            <div className="border-b border-white/25 p-[0.55rem]">
              <div className="border border-white/30 bg-white/[0.03] p-[0.55rem]">
                <p className="listen-now-playing flex items-center gap-1 font-mono text-[0.763rem] uppercase tracking-[0.06em] text-white/45 md:text-[0.636rem]">
                  {isPlaying ? "Now Playing" : "Paused"}
                  {isPlaying ? (
                    <Play
                      aria-hidden="true"
                      className="size-2 fill-white opacity-40 translate-y-[-0.6px]"
                    />
                  ) : null}
                </p>
                <RetroTrackMarquee
                  className="listen-current-track mt-[0.7rem] min-h-[1.8rem] font-mono text-[0.9rem] font-semibold leading-tight tracking-[-0.02em] text-white sm:text-[0.95rem] md:text-[0.84rem]"
                  isPlaying={isPlaying}
                  text={`${currentTrack.number.toString().padStart(2, "0")} ${currentTrack.artist} - ${currentTrack.title}`}
                />
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
                <div className="mt-2 flex justify-between font-mono text-[0.656rem] text-white/55 md:text-[0.547rem]">
                  <span className="tabular-nums text-[0.799rem] md:text-[0.666rem]">
                    {formatTime(currentTime)}
                  </span>
                  <span className="tabular-nums text-[0.799rem] md:text-[0.666rem]">
                    {formatTime(duration)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/20 pt-2">
                  <button
                    type="button"
                    aria-label="Previous track"
                    className="flex size-11 items-center justify-center border border-white/65 bg-black text-white/80 shadow-[2px_2px_0_0_rgba(255,255,255,0.5)] transition-[transform,box-shadow,color] duration-150 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-35 md:size-8 md:hover:translate-x-0.5 md:hover:translate-y-0.5 md:hover:shadow-none"
                    disabled={isFirstTrack || trackUrlState.status !== "ready"}
                    onClick={goToPreviousTrack}
                  >
                    <SkipBack className="size-[0.88rem] md:size-[0.68rem]" />
                  </button>
                  <button
                    type="button"
                    aria-label={isPlaying ? "Pause" : "Play"}
                    className={[
                      "flex size-11 items-center justify-center border border-white/65 transition-[transform,box-shadow,background-color,color] duration-150 active:translate-x-0.5 active:translate-y-0.5 focus:outline-none disabled:cursor-not-allowed disabled:opacity-35 md:size-8 md:hover:translate-x-0.5 md:hover:translate-y-0.5",
                      isPlaying
                        ? "bg-white/80 text-black shadow-none translate-x-px translate-y-px"
                        : "bg-black text-white/80 shadow-[2px_2px_0_0_rgba(255,255,255,0.5)] active:shadow-none md:hover:shadow-none",
                    ].join(" ")}
                    disabled={trackUrlState.status !== "ready"}
                    onClick={isPlaying ? pauseCurrentTrack : playCurrentTrack}
                  >
                    {isPlaying ? (
                      <Pause className="size-[0.88rem] md:size-[0.68rem]" />
                    ) : (
                      <Play className="size-[0.88rem] fill-current text-white/65 md:size-[0.68rem]" />
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label="Next track"
                    className="flex size-11 items-center justify-center border border-white/65 bg-black text-white/80 shadow-[2px_2px_0_0_rgba(255,255,255,0.5)] transition-[transform,box-shadow,color] duration-150 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-35 md:size-8 md:hover:translate-x-0.5 md:hover:translate-y-0.5 md:hover:shadow-none"
                    disabled={isLastTrack || trackUrlState.status !== "ready"}
                    onClick={goToNextTrack}
                  >
                    <SkipForward className="size-[0.88rem] md:size-[0.68rem]" />
                  </button>

                  <label className="ml-auto flex w-[calc(9rem-19px)] shrink-0 items-center gap-2 text-white/65">
                    <Volume2 className="size-[0.95rem] text-white/50" />
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

            <div className="listen-playlist-scrollbar pb-[3rem] min-h-0 flex-1 overflow-y-auto">
              {trackUrlState.status === "loading" ? (
                <ReleasePlaylistSkeleton />
              ) : null}

              {trackUrlState.status === "error" ? (
                <div className="flex h-full min-h-[18rem] items-center justify-center gap-3 px-6 text-[0.84rem] text-white/70 md:text-[0.7rem]">
                  <AlertTriangle className="size-5 shrink-0" />
                  <span>{trackUrlState.message}</span>
                </div>
              ) : null}

              {trackUrlState.status === "ready" ? (
                <ol className="divide-y divide-white/15 border-b border-white/15">
                  {sajs001cdRelease.tracks.map((track, index) => {
                    const selected = index === currentTrackIndex;

                    return (
                      <li key={track.slug}>
                        <button
                          type="button"
                          aria-current={selected ? "true" : undefined}
                          className={[
                            "relative grid w-full cursor-pointer grid-cols-[2.6rem_1fr_3.5rem] items-center gap-3 px-3 py-1.5 text-left transition-colors duration-200 focus:outline-none focus-visible:ring-white/80 sm:grid-cols-[3rem_1fr_4rem] sm:px-4",
                            selected
                              ? "bg-black text-white/92 hover:bg-white/[0.12]"
                              : "bg-black text-white/82 hover:bg-white/[0.12]",
                          ].join(" ")}
                          onClick={() => {
                            selectTrack(index);
                          }}
                        >
                          <span className="listen-track-number font-mono text-[0.869rem] tabular-nums opacity-70 md:text-[0.724rem]">
                            {track.number.toString().padStart(2, "0")}
                          </span>
                          {selected && hasStartedPlayback ? (
                            <Volume2
                              aria-hidden="true"
                              className="pointer-events-none absolute left-[2.725rem] top-1/2 size-3 -translate-y-1/2 -translate-x-1/2 text-white/60 sm:left-[3.375rem]"
                            />
                          ) : null}
                          <span className="min-w-0">
                            <span className="block truncate font-mono text-[0.863rem] uppercase tracking-[0.024em] md:text-[0.724rem]">
                              {track.title}
                            </span>
                            <span
                              className={[
                                "listen-artist mt-0.5 block truncate text-[0.95rem md:text-[0.79rem]",
                                selected
                                  ? "text-white/[0.7]"
                                  : "text-white/[0.62]",
                              ].join(" ")}
                            >
                              {track.artist}
                            </span>
                          </span>
                          <span className="text-right text-[0.827rem] tabular-nums opacity-60 md:text-[0.689rem]">
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
                setHasStartedPlayback(true);
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
              alt={`${catalogue} Odyssey cover preview`}
              className="max-h-[calc(100vh-4rem)] w-auto max-w-[calc(100vw-2rem)] object-contain"
              src={SAJS001CD_COVER_PATH}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}
