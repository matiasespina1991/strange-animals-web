export type MediaAssets = {
  images: {
    logo: string;
    tade: string;
    cd: string;
    basketballHoop: string;
  };
  audio: {
    enya: string;
    aphex: string;
    bluejaye: string;
    sillizium: string;
    tadeKop: string;
  };
  webampSkins: {
    lain: string;
  };
};

const transparentPixel =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

export const fallbackMediaAssets = {
  images: {
    logo: transparentPixel,
    tade: transparentPixel,
    cd: transparentPixel,
    basketballHoop: transparentPixel,
  },
  audio: {
    enya: '',
    aphex: '',
    bluejaye: '',
    sillizium: '',
    tadeKop: '',
  },
  webampSkins: {
    lain: '',
  },
} satisfies MediaAssets;
