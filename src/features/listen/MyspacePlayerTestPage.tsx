import { useEffect, useRef, useState } from "react";
import { getDownloadURL, ref } from "firebase/storage";
import { firebaseStorage } from "@/lib/firebase";
import { sajs003Release } from "./sajs003-release";

export default function MyspacePlayerTestPage() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void Promise.all(sajs003Release.tracks.map(async (track) => ({
      name: track.title, artist: track.artist, album: sajs003Release.title,
      url: await getDownloadURL(ref(firebaseStorage, track.storagePath)),
      cover_art_url: `${window.location.origin}/media/images/releases/sajs003/cover.png`,
    }))).then((songs) => {
      if (!cancelled) frame.current?.contentWindow?.postMessage({ type: "myspace-release", songs }, window.location.origin);
    }).catch((cause) => {
      if (cancelled) return;
      console.error("[MySpacePlayer] Release loading failed", cause);
      setError("Could not load the release. Please reload to try again.");
    });
    return () => { cancelled = true; };
  }, [ready]);
  return <main style={{ minHeight: "100dvh", background: "#0d1117", color: "#eee", padding: "32px 16px", fontFamily: "Arial, sans-serif", cursor: "auto" }}>
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <a href="/listen/sajs003" style={{ color: "#bbb" }}>← Original player</a>
      <h1 style={{ fontSize: 24, margin: "28px 0 8px" }}>MySpace player · test</h1>
      <p>SAJS003 — Jazz Licks Vol. I</p>
      {error ? <p role="alert">{error}</p> : <iframe ref={frame} onLoad={() => setReady(true)} title="MySpace music player — Jazz Licks Vol. I" src="/experiments/myspace-player/index.html" style={{ border: 0, width: "100%", height: 580 }} />}
      <p style={{ color: "#aaa", fontSize: 12 }}>Experimental page. The equalizer is decorative, as in the original project.</p>
      <a style={{ color: "#aaa", fontSize: 12 }} href="https://github.com/DeadSuperHero/myspace-music-player-extended">MySpace Music Player Extended · MIT</a>
    </div>
  </main>;
}
