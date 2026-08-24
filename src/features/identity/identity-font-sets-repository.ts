import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import {getDownloadURL, ref, uploadBytes} from 'firebase/storage';
import {firebaseDb, firebaseStorage} from '@/lib/firebase';

const FONT_SET_VERSION = 1;
const MAX_LABEL_LENGTH = 120;
const MAX_SPECIMEN_LENGTH = 800;
const MAX_SEARCH_LENGTH = 140;
const MAX_STORED_FONT_IDS = 500;
const FONT_ID_PATTERN = /^[\w-]{1,200}$/i;

type FontSetBackground = {
  color: string;
  mode: 'color' | 'image';
  imageName?: string;
  imageStoragePath?: string;
  imageUrl?: string;
};

type FontSetDocument = {
  backgroundColor?: unknown;
  backgroundImageName?: unknown;
  backgroundImageStoragePath?: unknown;
  backgroundMode?: unknown;
  createdAt?: unknown;
  favoriteFontKeys?: unknown;
  fontColor?: unknown;
  fontSize?: unknown;
  fontWeight?: unknown;
  label?: unknown;
  letterSpacing?: unknown;
  lineHeight?: unknown;
  pinnedFontKeys?: unknown;
  search?: unknown;
  showOnlyFavorites?: unknown;
  specimen?: unknown;
  textAlignment?: unknown;
  updatedAt?: unknown;
  version?: unknown;
};

export type IdentityFontSet = {
  id: string;
  background: FontSetBackground;
  createdAt: Date | null;
  favoriteFontIds: string[];
  fontColor: string;
  fontSize: number;
  fontWeight: '300' | 'normal' | '800';
  label: string;
  letterSpacing: number;
  lineHeight: number;
  pinnedFontIds: string[];
  search: string;
  showOnlyFavorites: boolean;
  specimen: string;
  textAlignment: 'left' | 'center' | 'right';
  updatedAt: Date | null;
};

export type SaveIdentityFontSetInput = {
  backgroundColor: string;
  backgroundImageFile?: File;
  backgroundImageName?: string;
  backgroundImageStoragePath?: string;
  backgroundMode: 'color' | 'image';
  browserId: string;
  favoriteFontIds: string[];
  fontColor: string;
  fontSize: number;
  fontWeight: '300' | 'normal' | '800';
  letterSpacing: number;
  lineHeight: number;
  pinnedFontIds: string[];
  search: string;
  showOnlyFavorites: boolean;
  specimen: string;
  textAlignment: 'left' | 'center' | 'right';
};

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(maxLength - 1, 1)).trimEnd()}...`;
}

function toDateOrNull(value: unknown) {
  if (value instanceof Timestamp) return value.toDate();
  return null;
}

function readStoredFontIds(value: unknown) {
  if (typeof value !== 'string' || value.length === 0) return [];

  return [...new Set(value.split(','))]
    .filter((fontId) => FONT_ID_PATTERN.test(fontId))
    .slice(0, MAX_STORED_FONT_IDS);
}

function serializeFontIds(fontIds: string[]) {
  return [...new Set(fontIds)]
    .filter((fontId) => FONT_ID_PATTERN.test(fontId))
    .slice(0, MAX_STORED_FONT_IDS)
    .join(',');
}

function normalizeFileName(fileName: string) {
  const trimmedName = fileName.trim();
  const parts = trimmedName.split('.');
  const extension = parts.length > 1 ? parts.pop() : undefined;
  const stem = (parts.join('.') || trimmedName || 'background')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  const normalizedStem = stem || 'background';
  const normalizedExtension =
    extension && /^[a-zA-Z0-9]{1,10}$/.test(extension)
      ? extension.toLowerCase()
      : undefined;

  return normalizedExtension
    ? `${normalizedStem}.${normalizedExtension}`
    : normalizedStem;
}

function deriveLabel(specimen: string, search: string) {
  const normalizedSpecimen = specimen.trim().replace(/\s+/g, ' ');

  if (normalizedSpecimen.length > 0) {
    return truncateText(normalizedSpecimen, MAX_LABEL_LENGTH);
  }

  const normalizedSearch = search.trim().replace(/\s+/g, ' ');

  if (normalizedSearch.length > 0) {
    return truncateText(`Search: ${normalizedSearch}`, MAX_LABEL_LENGTH);
  }

  return 'Untitled set';
}

function readFontSet(id: string, value: FontSetDocument): IdentityFontSet | null {
  if (value.version !== FONT_SET_VERSION) return null;
  if (typeof value.label !== 'string') return null;
  if (typeof value.specimen !== 'string') return null;
  if (typeof value.search !== 'string') return null;
  if (typeof value.fontColor !== 'string') return null;
  if (typeof value.backgroundColor !== 'string') return null;
  if (typeof value.fontSize !== 'number') return null;
  if (typeof value.lineHeight !== 'number') return null;
  if (typeof value.letterSpacing !== 'number') return null;
  if (
    value.fontWeight !== '300' &&
    value.fontWeight !== 'normal' &&
    value.fontWeight !== '800'
  ) {
    return null;
  }
  if (
    value.textAlignment !== 'left' &&
    value.textAlignment !== 'center' &&
    value.textAlignment !== 'right'
  ) {
    return null;
  }
  if (value.backgroundMode !== 'color' && value.backgroundMode !== 'image') {
    return null;
  }

  const background = {
    color: value.backgroundColor,
    mode: value.backgroundMode,
    imageName:
      typeof value.backgroundImageName === 'string'
        ? value.backgroundImageName
        : undefined,
    imageStoragePath:
      typeof value.backgroundImageStoragePath === 'string'
        ? value.backgroundImageStoragePath
        : undefined,
  } satisfies FontSetBackground;

  return {
    id,
    background,
    createdAt: toDateOrNull(value.createdAt),
    favoriteFontIds: readStoredFontIds(value.favoriteFontKeys),
    fontColor: value.fontColor,
    fontSize: value.fontSize,
    fontWeight: value.fontWeight,
    label: value.label,
    letterSpacing: value.letterSpacing,
    lineHeight: value.lineHeight,
    pinnedFontIds: readStoredFontIds(value.pinnedFontKeys),
    search: value.search,
    showOnlyFavorites: value.showOnlyFavorites === true,
    specimen: value.specimen,
    textAlignment: value.textAlignment,
    updatedAt: toDateOrNull(value.updatedAt),
  } satisfies IdentityFontSet;
}

async function uploadBackgroundImage(
  browserId: string,
  setId: string,
  backgroundImageFile: File,
) {
  const normalizedFileName = normalizeFileName(backgroundImageFile.name);
  const storagePath = `media/private/identity-font-sets/${browserId}/${setId}/v1/${normalizedFileName}`;

  await uploadBytes(ref(firebaseStorage, storagePath), backgroundImageFile, {
    contentType: backgroundImageFile.type || 'application/octet-stream',
    customMetadata: {
      browserId,
      setId,
      sourceFileName: backgroundImageFile.name,
    },
  });

  return {
    imageName: backgroundImageFile.name,
    imageStoragePath: storagePath,
  };
}

export async function listIdentityFontSets(browserId: string) {
  const snapshot = await getDocs(
    collection(firebaseDb, 'users', browserId, 'fontSets'),
  );

  const sets = await Promise.all(
    snapshot.docs.map(async (documentSnapshot) => {
      const data = readFontSet(
        documentSnapshot.id,
        documentSnapshot.data() as FontSetDocument,
      );

      if (!data) return null;

      if (data.background.mode === 'image' && data.background.imageStoragePath) {
        const imageUrl = await getDownloadURL(
          ref(firebaseStorage, data.background.imageStoragePath),
        ).catch(() => undefined);

        if (imageUrl) {
          return {
            ...data,
            background: {
              ...data.background,
              imageStoragePath: data.background.imageStoragePath,
              imageName: data.background.imageName,
              imageUrl,
            },
          };
        }
      }

      return data;
    }),
  );

  return sets
    .filter((set): set is IdentityFontSet => set !== null)
    .sort((left, right) => {
      const leftTime = left.updatedAt?.getTime() ?? left.createdAt?.getTime() ?? 0;
      const rightTime =
        right.updatedAt?.getTime() ?? right.createdAt?.getTime() ?? 0;

      return rightTime - leftTime;
    });
}

export async function saveIdentityFontSet(input: SaveIdentityFontSetInput) {
  const setId = crypto.randomUUID();
  const setReference = doc(firebaseDb, 'users', input.browserId, 'fontSets', setId);

  const specimen = truncateText(input.specimen, MAX_SPECIMEN_LENGTH);
  const search = truncateText(input.search, MAX_SEARCH_LENGTH);
  const label = deriveLabel(specimen, search);

  let backgroundImageName: string | undefined;
  let backgroundImageStoragePath: string | undefined;

  if (input.backgroundMode === 'image') {
    if (input.backgroundImageFile) {
      const uploadedImage = await uploadBackgroundImage(
        input.browserId,
        setId,
        input.backgroundImageFile,
      );
      backgroundImageName = uploadedImage.imageName;
      backgroundImageStoragePath = uploadedImage.imageStoragePath;
    } else if (input.backgroundImageStoragePath) {
      backgroundImageName = input.backgroundImageName ?? 'Saved image';
      backgroundImageStoragePath = input.backgroundImageStoragePath;
    }
  }

  const effectiveBackgroundMode =
    input.backgroundMode === 'image' && backgroundImageStoragePath
      ? 'image'
      : 'color';

  await setDoc(setReference, {
    backgroundColor: input.backgroundColor,
    ...(backgroundImageName
      ? {
          backgroundImageName,
          backgroundImageStoragePath,
        }
      : {}),
    backgroundMode: effectiveBackgroundMode,
    createdAt: serverTimestamp(),
    favoriteFontKeys: serializeFontIds(input.favoriteFontIds),
    fontColor: input.fontColor,
    fontSize: input.fontSize,
    fontWeight: input.fontWeight,
    label,
    letterSpacing: input.letterSpacing,
    lineHeight: input.lineHeight,
    pinnedFontKeys: serializeFontIds(input.pinnedFontIds),
    search,
    showOnlyFavorites: input.showOnlyFavorites,
    specimen,
    textAlignment: input.textAlignment,
    updatedAt: serverTimestamp(),
    version: FONT_SET_VERSION,
  });

  return setId;
}
