import {doc, getDoc} from 'firebase/firestore';
import {getDownloadURL, ref} from 'firebase/storage';
import {firebaseDb, firebaseStorage} from '@/lib/firebase';
import type {MediaAssets} from '../domain/media-assets';

type MediaCollection = 'images' | 'tracks' | 'webampSkins';

type HomeMediaDefinition = {
  collection: MediaCollection;
  id: string;
};

type MediaDocument = {
  enabled?: boolean;
  storagePath?: string;
};

const homeMediaDefinitions = {
  images: {
    logo: {collection: 'images', id: 'logo'},
    tade: {collection: 'images', id: 'tade'},
    cd: {collection: 'images', id: 'cd'},
    basketballHoop: {collection: 'images', id: 'basketball-hoop'},
  },
  audio: {
    enya: {collection: 'tracks', id: 'enya-caribbean-blue'},
    aphex: {collection: 'tracks', id: 'aphex-twin-tha'},
    bluejaye: {collection: 'tracks', id: 'bluejaye-beginning'},
    sillizium: {collection: 'tracks', id: 'sillizium-coldsunset'},
    tadeKop: {collection: 'tracks', id: 'tade-kop-untitled'},
  },
  webampSkins: {
    lain: {collection: 'webampSkins', id: 'lain'},
  },
} satisfies Record<string, Record<string, HomeMediaDefinition>>;

async function resolveMediaUrl(definition: HomeMediaDefinition) {
  const snapshot = await getDoc(
    doc(firebaseDb, definition.collection, definition.id),
  );

  if (!snapshot.exists()) {
    throw new Error(`Missing ${definition.collection}/${definition.id}`);
  }

  const media = snapshot.data() as MediaDocument;

  if (!media.enabled || !media.storagePath) {
    throw new Error(`Disabled ${definition.collection}/${definition.id}`);
  }

  return getDownloadURL(ref(firebaseStorage, media.storagePath));
}

async function resolveMediaGroup(
  group: Record<string, HomeMediaDefinition>,
) {
  const entries = await Promise.all(
    Object.entries(group).map(async ([key, definition]) => [
      key,
      await resolveMediaUrl(definition),
    ]),
  );

  return Object.fromEntries(entries);
}

export async function getHomeMediaAssets(): Promise<MediaAssets> {
  const [images, audio, webampSkins] = await Promise.all([
    resolveMediaGroup(homeMediaDefinitions.images),
    resolveMediaGroup(homeMediaDefinitions.audio),
    resolveMediaGroup(homeMediaDefinitions.webampSkins),
  ]);

  return {
    images,
    audio,
    webampSkins,
  } as MediaAssets;
}
