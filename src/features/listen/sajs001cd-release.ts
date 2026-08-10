export type Sajs001cdTrack = {
  artist: string;
  durationLabel?: string;
  number: number;
  slug: string;
  storagePath: string;
  title: string;
};

export const sajs001cdRelease = {
  artist: 'Various Artists',
  catalogue: 'SAJS001CD',
  title: 'Odyssey',
  tracks: [
    {
      artist: 'Tade Kop',
      durationLabel: '2:05',
      number: 1,
      slug: 'tade-kop-heroe',
      storagePath: 'media/public/audio/tracks/tade-kop-heroe/v1/source.wav',
      title: 'Heroe',
    },
    {
      artist: 'Taxiburon',
      durationLabel: '2:41',
      number: 2,
      slug: 'taxiburon-shiro-kyo',
      storagePath:
        'media/public/audio/tracks/taxiburon-shiro-kyo/v1/source.wav',
      title: 'Shiro Kyo',
    },
    {
      artist: 'Indi Zone',
      durationLabel: '7:42',
      number: 3,
      slug: 'indi-zone-imps-tale-eco-6-remix-edit',
      storagePath:
        'media/public/audio/tracks/indi-zone-imps-tale-eco-6-remix-edit/v1/source.wav',
      title: "Imp's Tale (Eco 6 Remix) [Edit]",
    },
    {
      artist: 'Index',
      durationLabel: '4:38',
      number: 4,
      slug: 'index-2nd-twilight-feat-tweety-gonzalez',
      storagePath:
        'media/public/audio/tracks/index-2nd-twilight-feat-tweety-gonzalez/v1/source.wav',
      title: '2nd Twilight (feat. Tweety Gonzalez)',
    },
    {
      artist: 'Sillizium',
      durationLabel: '6:22',
      number: 5,
      slug: 'sillizium-andropolis',
      storagePath:
        'media/public/audio/tracks/sillizium-andropolis/v1/source.wav',
      title: 'Andropolis',
    },
    {
      artist: 'BBRAINZ',
      durationLabel: '1:36',
      number: 6,
      slug: 'bbrainz-work-this-out-control',
      storagePath:
        'media/public/audio/tracks/bbrainz-work-this-out-control/v1/source.wav',
      title: 'Work This Out (Control)',
    },
    {
      artist: 'Delazar feat Lulu Matheu',
      durationLabel: '4:52',
      number: 7,
      slug: 'delazar-feat-lulu-matheu-mirame-bien-instrumental',
      storagePath:
        'media/public/audio/tracks/delazar-feat-lulu-matheu-mirame-bien-instrumental/v1/source.wav',
      title: 'Mirame Bien (Instrumental)',
    },
    {
      artist: 'Midu',
      durationLabel: '1:48',
      number: 8,
      slug: 'midu-nunca-deja-de-caer-interlude',
      storagePath:
        'media/public/audio/tracks/midu-nunca-deja-de-caer-interlude/v1/source.wav',
      title: 'Nunca Deja De Caer [Interlude]',
    },
    {
      artist: 'Bluejaye',
      durationLabel: '6:42',
      number: 9,
      slug: 'bluejaye-beginning-1996-live-mix',
      storagePath:
        'media/public/audio/tracks/bluejaye-beginning-1996-live-mix/v1/source.wav',
      title: 'Beginning (1996 Live Mix)',
    },
    {
      artist: 'Estimulo',
      durationLabel: '5:54',
      number: 10,
      slug: 'estimulo-e-mulated',
      storagePath: 'media/public/audio/tracks/estimulo-e-mulated/v1/source.wav',
      title: 'E-Mulated',
    },
    {
      artist: 'GL3W',
      durationLabel: '5:42',
      number: 11,
      slug: 'gl3w-untitled',
      storagePath: 'media/public/audio/tracks/gl3w-untitled/v1/source.wav',
      title: 'Untitled',
    },
  ] satisfies Sajs001cdTrack[],
} as const;
