export function Sajs002ListenPage() {
  return (
    <main
      data-native-cursor-surface
      className="listen-page-amiga min-h-screen bg-[#050505] px-[0.4rem] pb-10 pt-2 text-[0.96rem] text-white sm:px-6 sm:py-4 md:text-[0.8rem] lg:px-8"
    >
      <section className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl flex-col justify-center">
        <div className="grid gap-4 lg:grid-cols-[minmax(16rem,calc(48%-5rem))_minmax(0,1fr)] lg:items-start">
          <article className="flex min-h-0 flex-col bg-black p-4 sm:p-5 lg:min-h-[31rem]">
            <p className="font-mono text-[0.73rem] uppercase tracking-[0.066em] text-white/60 md:text-[0.75rem]">
              <a
                href="/?redirectSource=internal"
                className="hover:text-white/80"
              >
                Strange Animals
              </a>{" "}
              &gt; Jungle Series &gt; SAJS002
            </p>
            <div className="mt-[0.52rem] flex flex-col items-start gap-[0.7rem]">
              <span className="border border-white/35 px-1.5 pb-[0.075rem] pt-[0.1rem] font-mono text-[0.58rem] uppercase leading-none tracking-[0.08em] text-white/60">
                Out soon
              </span>
              <h1 className="release-title font-microgramma text-[1.8rem] font-medium uppercase leading-[0.9] tracking-[0.06em] text-white sm:text-[1.3rem] md:leading-[1.2]">
                V.A. Hacking The System
              </h1>
            </div>

            <div className="mt-6 flex flex-col gap-[1.7rem]">
              <div
                aria-label="No artwork yet"
                className="flex aspect-square w-full max-w-[12.6rem] shrink-0 items-center justify-center border border-white/20 bg-white/[0.03] p-4 text-center font-mono text-[0.68rem] uppercase tracking-[0.12em] text-white/45"
                role="img"
              >
                No artwork yet
              </div>
              <div className="font-facit max-w-sm font-light text-[calc(0.91rem-0.95px)] leading-[1.8rem] tracking-[0.3px] text-white/64 md:leading-[1.3rem]">
                <p>
                  Strange Animals presents Hacking The System, a showcase
                  spanning the full spectrum of jungle, drum n bass, and
                  different branches of breakbeat.
                </p>

                <span className="mt-3 block">
                  Release date:{" "}
                  <strong className="font-semibold">June 2027</strong>
                </span>
                <span className="mt-3 block">Catalog #: SAJS002</span>
                <span className="mt-3 block">Format: CD + Vinyl Samplers</span>
              </div>
            </div>
          </article>
          <div
            aria-hidden="true"
            className="hidden lg:block lg:min-h-[42rem]"
          />
        </div>
      </section>
    </main>
  );
}
