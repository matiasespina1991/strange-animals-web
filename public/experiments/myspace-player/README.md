# Isolated MySpace player experiment

Route: `/listen/myspace-test`. No changes to the existing Listen players.

Vendored from https://github.com/DeadSuperHero/myspace-music-player-extended
at commit `37016aa398c52299a8dfbfcadce5105feefe2c68`
(MIT; see vendor/LICENSE). Includes its AmplitudeJS 5.3.2 distribution
(MIT; see vendor/AMPLITUDE-LICENSE), icon font, original CSS and static equalizer.
No upstream audio or album art is included. SAJS003 uses the existing release
metadata and Firebase audio URLs.

The iframe isolates upstream CSS and audio lifecycle. The wrapper passes the
release through an origin/source-checked message; track names are inserted as
text, never HTML. There is no autoplay or global keyboard interception.
The equalizer is intentionally decorative, not an audio spectrum analyzer.

To remove: delete this folder, MyspacePlayerTestPage.tsx, and its lazy route
in App.tsx. The regular Listen pages have no dependency on this experiment.
