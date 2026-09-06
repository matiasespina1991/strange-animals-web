export type Sajs003Track = {
  artist: string;
  durationLabel?: string;
  number: string;
  slug: string;
  storagePath: string;
  title: string;
};

export const sajs003Release = {
  artist: "Various Artists",
  catalogue: "SAJS003",
  title: "Jazz Licks Vol. I",
  tracks: [
    {
      artist: "Michele Manzo",
      durationLabel: "6:32",
      number: "A1",
      slug: "michele-manzo-cinema-breaks-v1",
      storagePath:
        "media/public/audio/tracks/sajs003-michele-manzo-cinema-breaks-v1/v2/source.mp3",
      title: "Cinema Breaks (v.1)",
    },
    {
      artist: "Index",
      durationLabel: "5:40",
      number: "A2",
      slug: "index-hazy-horizon-feat-german-rossi",
      storagePath:
        "media/public/audio/tracks/sajs003-index-hazy-horizon-feat-german-rossi/v2/source.mp3",
      title: "Hazy Horizon (feat. German Rossi)",
    },
    {
      artist: "Silizium",
      durationLabel: "6:45",
      number: "A3",
      slug: "silizium-test-drive-ps1-8",
      storagePath:
        "media/public/audio/tracks/sajs003-silizium-test-drive-ps1-8/v2/source.mp3",
      title: "TestDrivePS1-8",
    },
    {
      artist: "Bluejaye a.k.a. Ewan Jansen",
      durationLabel: "7:00",
      number: "B1",
      slug: "ewan-jansen-jazz-mellow",
      storagePath:
        "media/public/audio/tracks/sajs003-ewan-jansen-jazz-mellow/v2/source.mp3",
      title: "Jazz Mellow",
    },
    {
      artist: "Ronan Portela",
      durationLabel: "6:31",
      number: "B2",
      slug: "ronan-portela-smooth-index-deep-n-bass-mix",
      storagePath:
        "media/public/audio/tracks/sajs003-ronan-portela-smooth-index-deep-n-bass-mix/v1/source.mp3",
      title: "Smooth (Index Deep N Bass Mix)",
    },
    {
      artist: "Tade",
      durationLabel: "2:49",
      number: "B3",
      slug: "tade-untitled",
      storagePath:
        "media/public/audio/tracks/sajs003-tade-untitled/v1/source.mp3",
      title: "Untitled",
    },
  ] satisfies Sajs003Track[],
} as const;
