const doomPagePath = "/media/games/doom-on-js-dos/index.html";

export function DoomJsDosPage() {
  return (
    <main className="min-h-screen bg-black">
      <iframe
        className="block h-screen w-screen border-0"
        src={doomPagePath}
        title="DOOM"
      />
    </main>
  );
}
