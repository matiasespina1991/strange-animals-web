import { useEffect, useState } from "react";

const releaseFontFaces = [
  '400 1em "Inconsolata"',
  '400 1em "TerminalVision"',
  '500 1em "Microgramma"',
  '300 1em "Facit"',
];

function areReleaseFontsReady() {
  if (typeof document === "undefined" || !("fonts" in document)) {
    return true;
  }

  return releaseFontFaces.every((fontFace) => document.fonts.check(fontFace));
}

export function useReleaseFontsReady() {
  const [ready, setReady] = useState(areReleaseFontsReady);

  useEffect(() => {
    if (ready || typeof document === "undefined" || !("fonts" in document)) {
      return;
    }

    let cancelled = false;

    void Promise.allSettled(
      releaseFontFaces.map((fontFace) => document.fonts.load(fontFace)),
    ).then(() => {
      requestAnimationFrame(() => {
        if (!cancelled) {
          setReady(true);
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [ready]);

  return ready;
}

const skeletonBlock = "bg-white/[0.08]";

export function ReleasePlaylistSkeleton() {
  return (
    <div aria-hidden="true" className="min-h-0 flex-1 pb-[3rem]">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="grid min-h-[4.75rem] grid-cols-[2.6rem_1fr_3.5rem] items-center gap-3 border-b border-white/15 px-3 py-1.5 sm:grid-cols-[3rem_1fr_4rem] sm:px-4"
        >
          <div className={`${skeletonBlock} h-2 w-5`} />
          <div className="space-y-2">
            <div className={`${skeletonBlock} h-2.5 w-3/5`} />
            <div className={`${skeletonBlock} h-2 w-1/3`} />
          </div>
          <div className={`${skeletonBlock} ml-auto h-2 w-7`} />
        </div>
      ))}
    </div>
  );
}

export function ReleasePageLoadingSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading release"
      className="listen-page-amiga min-h-screen bg-[#050505] pr-[0.55rem] pl-[0.3rem] pb-4 pt-2 sm:px-6 sm:py-4 lg:px-8"
      data-native-cursor-surface
    >
      <section className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl flex-col justify-center">
        <div className="grid gap-4 lg:grid-cols-[minmax(16rem,calc(48%-5rem))_minmax(0,1fr)] lg:items-start">
          <div className="flex min-h-0 flex-col bg-black p-4 sm:p-5 lg:min-h-[31rem]">
            <div className="space-y-4" aria-hidden="true">
              <div className={`${skeletonBlock} h-2.5 w-48`} />
              <div className={`${skeletonBlock} h-4 w-14`} />
              <div className={`${skeletonBlock} h-14 w-full max-w-sm`} />
              <div className="mt-6 flex flex-col gap-4 min-[715px]:max-[1023px]:flex-row min-[715px]:max-[1023px]:items-start">
                <div
                  className={`${skeletonBlock} aspect-square w-full max-w-[12.6rem] shrink-0`}
                />
                <div className="flex flex-1 flex-col gap-3 pt-1">
                  <div className={`${skeletonBlock} h-3 w-full`} />
                  <div className={`${skeletonBlock} h-3 w-11/12`} />
                  <div className={`${skeletonBlock} h-3 w-4/5`} />
                  <div className={`${skeletonBlock} mt-3 h-3 w-2/5`} />
                  <div className={`${skeletonBlock} h-3 w-1/2`} />
                </div>
              </div>
            </div>
          </div>

          <div className="mx-4 mt-0 flex min-h-0 min-w-0 max-h-[calc(100vh-4.7rem)] flex-col lg:mx-0 lg:mt-5 lg:h-[42rem]">
            <p className="mb-3 shrink-0 font-mono text-[0.73rem] uppercase tracking-[0.066em] text-white/60 md:text-[0.75rem]">
              Preview:
            </p>
            <div className="listen-player flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-[0.5px] border-white/50 bg-black ring-inset ring-white/20 md:shadow-[2.4px_2.4px_0_0_rgba(255,255,255,0.45)]">
            <div
              className="border-b border-white/25 p-[0.55rem]"
              aria-hidden="true"
            >
              <div className="border border-white/30 bg-white/[0.03] p-[0.55rem]">
                <div className={`${skeletonBlock} h-2.5 w-20`} />
                <div className={`${skeletonBlock} mt-3 h-4 w-3/5`} />
                <div className="mt-3 h-2 border border-white/25 p-px">
                  <div className={`${skeletonBlock} h-full w-1/3`} />
                </div>
                <div className="mt-2 flex justify-between">
                  <div className={`${skeletonBlock} h-2 w-7`} />
                  <div className={`${skeletonBlock} h-2 w-7`} />
                </div>
                <div className="mt-2 flex items-center border-t border-white/20 pt-2">
                  <div className={`${skeletonBlock} size-8`} />
                  <div className={`${skeletonBlock} ml-2 size-8`} />
                  <div className={`${skeletonBlock} ml-2 size-8`} />
                  <div className={`${skeletonBlock} ml-auto h-2 w-28`} />
                </div>
              </div>
            </div>
            <ReleasePlaylistSkeleton />
          </div>
          </div>
        </div>
      </section>
    </main>
  );
}
