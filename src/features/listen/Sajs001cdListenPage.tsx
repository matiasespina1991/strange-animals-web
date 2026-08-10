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
import { sajs001cdRelease } from "./sajs001cd-release";

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
    if (
      !("mediaSession" in navigator) ||
      typeof MediaMetadata === "undefined"
    ) {
      return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: `${sajs001cdRelease.title} (${sajs001cdRelease.catalogue})`,
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

  return (
    <main className="listen-page-amiga min-h-screen bg-[#050505] pr-3 pl-2 py-4 text-[0.8rem] text-white sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl flex-col justify-center">
        <div className="grid gap-4 lg:grid-cols-[minmax(16rem,calc(43%-5rem))_1fr] lg:items-stretch">
          <div className="flex min-h-0 flex-col justify-between bg-black p-4 sm:p-5 lg:min-h-[31rem]">
            <div>
              <p className="font-mono text-[0.845rem] uppercase tracking-[0.11em] text-white/55">
                {sajs001cdRelease.catalogue}
              </p>
              <h1 className="mt-4 font-mono text-[1.8rem] uppercase leading-[0.9] tracking-normal text-white sm:text-[1.8rem]">
                V.A. Odyssey Vol. 1 (CD)
              </h1>
              <div className="mt-6 flex flex-col gap-4 min-[715px]:max-[1023px]:flex-row min-[715px]:max-[1023px]:items-start">
                <img
                  alt="SAJS001CD Odyssey cover"
                  className="aspect-square w-full max-w-[12.6rem] shrink-0 border border-white/45 object-cover"
                  src={SAJS001CD_COVER_PATH}
                />
                <p className="max-w-sm text-[0.8125rem] leading-6 text-white/64">
                  Strange Animals presents Odyssey Vol. 1, a compilation album
                  consisting of a selection of tracks from various artists,
                  showcasing a wide spectrum of sounds inspired by liquid drum n
                  bass/jungle.
                  <span className="mt-3 block">
                    All tracks mastered by Beau Thomas.
                  </span>
                  <span className="mt-3 block">
                    Original artwork by Laura Butallo.
                  </span>
                  <span className="mt-3 block">Release date: TBD 2026</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 max-h-[calc(100vh-2rem)] flex-col overflow-hidden border border-white/70 bg-black ring-inset ring-white/30 md:shadow-[3px_3px_0_0_rgba(255,255,255,0.85)]">
            <div className="border-b border-white/35 px-3 py-3 sm:px-4">
              <div className="mb-4 border border-white/35 bg-white/[0.03] p-3">
                <p className="font-mono text-[0.669rem] uppercase tracking-[0.1em] text-white/45">
                  Now Playing
                </p>
                <p className="mt-2 min-h-12 font-mono text-[0.9rem] leading-tight text-white">
                  <span className="tabular-nums text-[1.025rem]">
                    {currentTrack.number.toString().padStart(2, "0")} /
                  </span>{" "}
                  {currentTrack.artist} - {currentTrack.title}
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
                <div className="mt-2 flex justify-between font-mono text-[0.576rem] text-white/55">
                  <span className="tabular-nums text-[0.701rem]">
                    {formatTime(currentTime)}
                  </span>
                  <span className="tabular-nums text-[0.701rem]">
                    {formatTime(duration)}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-label="Previous track"
                  className="flex size-8 items-center justify-center border border-white/70 bg-black text-white/90 shadow-[2px_2px_0_0_rgba(255,255,255,0.7)] transition-[transform,box-shadow,color] duration-150 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-35"
                  disabled={isFirstTrack || trackUrlState.status !== "ready"}
                  onClick={goToPreviousTrack}
                >
                  <SkipBack className="size-[0.8rem]" />
                </button>
                <button
                  type="button"
                  aria-label={isPlaying ? "Pause" : "Play"}
                  className="flex size-8 items-center justify-center border border-white/80 bg-white text-black shadow-[2px_2px_0_0_rgba(255,255,255,0.7)] transition-[transform,box-shadow,background-color] duration-150 hover:translate-x-0.5 hover:translate-y-0.5 hover:bg-white/90 hover:shadow-none focus:outline-none  disabled:cursor-not-allowed disabled:opacity-35"
                  disabled={trackUrlState.status !== "ready"}
                  onClick={isPlaying ? pauseCurrentTrack : playCurrentTrack}
                >
                  {isPlaying ? (
                    <Pause className="size-[0.8rem]" />
                  ) : (
                    <Play className="size-[0.8rem]" />
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Next track"
                  className="flex size-8 items-center justify-center border border-white/70 bg-black text-white/90 shadow-[2px_2px_0_0_rgba(255,255,255,0.7)] transition-[transform,box-shadow,color] duration-150 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-35"
                  disabled={isLastTrack || trackUrlState.status !== "ready"}
                  onClick={goToNextTrack}
                >
                  <SkipForward className="size-[0.8rem]" />
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

            <div className="listen-playlist-scrollbar min-h-0 flex-1 overflow-y-auto">
              {trackUrlState.status === "loading" ? (
                <div className="flex h-full min-h-[18rem] items-center justify-center gap-3 font-mono text-[0.7rem] uppercase tracking-[0.08em] text-white/60">
                  <Loader2 className="size-4 animate-spin" />
                  Loading WAVs
                </div>
              ) : null}

              {trackUrlState.status === "error" ? (
                <div className="flex h-full min-h-[18rem] items-center justify-center gap-3 px-6 text-[0.7rem] text-white/70">
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
                            "grid w-full cursor-pointer grid-cols-[2.6rem_1fr_3.5rem] items-center gap-3 px-3 py-2 text-left transition-colors duration-200 focus:outline-none focus-visible:ring-white/80 sm:grid-cols-[3rem_1fr_4rem] sm:px-4",
                            selected
                              ? "bg-white/[0.82] text-black"
                              : "bg-black text-white/82 hover:bg-white/[0.12]",
                          ].join(" ")}
                          onClick={() => {
                            selectTrack(index);
                          }}
                        >
                          <span className="font-mono text-[0.7625rem] tabular-nums opacity-70">
                            {track.number.toString().padStart(2, "0")}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-mono text-[0.825rem] uppercase tracking-[0.04em]">
                              {track.title}
                            </span>
                            <span
                              className={[
                                "mt-0.5 block truncate text-[0.751rem] font-semibold",
                                selected ? "text-black/68" : "text-white/48",
                              ].join(" ")}
                            >
                              {track.artist}
                            </span>
                          </span>
                          <span className="text-right text-[0.725rem] tabular-nums opacity-60">
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
