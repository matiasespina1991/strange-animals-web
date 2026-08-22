/* eslint-disable no-await-in-loop -- Destructive Storage and Firestore batches are intentionally bounded and sequential. */
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import {deleteObject, getBytes, ref} from 'firebase/storage';
import {firebaseDb, firebaseStorage} from '@/lib/firebase';

const MAX_PREVIEW_SIZE_BYTES = 20 * 1024 * 1024;
const DELETE_CONCURRENCY = 8;
const FIRESTORE_BATCH_SIZE = 450;

type FontPreviewDocument = {
  fileName?: unknown;
  format?: unknown;
  storagePath?: unknown;
};

type FontCatalogDocument = {
  displayName?: unknown;
  enabled?: unknown;
  fileCount?: unknown;
  formats?: unknown;
  kind?: unknown;
  name?: unknown;
  preview?: unknown;
  sortName?: unknown;
  variantCount?: unknown;
};

type FontFileDocument = {
  contentType?: unknown;
  enabled?: unknown;
  extension?: unknown;
  fileName?: unknown;
  kind?: unknown;
  relativePath?: unknown;
  storagePath?: unknown;
};

export type FontCatalogItem = {
  id: string;
  name: string;
  sortName: string;
  kind: 'collection' | 'family';
  formats: string[];
  fileCount: number;
  variantCount: number;
  preview: {
    fileName: string;
    format: string;
    storagePath: string;
  } | null;
};

export type FontVariant = {
  id: string;
  contentType: string;
  extension: string;
  fileName: string;
  relativePath: string;
  storagePath: string;
};

const fontLoads = new Map<string, Promise<string>>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readPositiveInteger(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : 0;
}

function readPreview(value: unknown) {
  if (!isRecord(value)) return null;

  const preview = value as FontPreviewDocument;

  if (
    typeof preview.fileName !== 'string' ||
    typeof preview.format !== 'string' ||
    typeof preview.storagePath !== 'string' ||
    !preview.storagePath.startsWith('media/private/fonts/')
  ) {
    return null;
  }

  return {
    fileName: preview.fileName,
    format: preview.format,
    storagePath: preview.storagePath,
  };
}

function readFont(id: string, value: FontCatalogDocument) {
  if (value.enabled !== true || typeof value.name !== 'string') return null;

  const displayName =
    typeof value.displayName === 'string' && value.displayName.trim()
      ? value.displayName.trim()
      : value.name;

  return {
    id,
    name: displayName,
    sortName:
      typeof value.sortName === 'string'
        ? value.sortName
        : displayName.toLocaleLowerCase(),
    kind: value.kind === 'collection' ? 'collection' : 'family',
    formats: Array.isArray(value.formats)
      ? value.formats.filter(
          (format): format is string => typeof format === 'string',
        )
      : [],
    fileCount: readPositiveInteger(value.fileCount),
    variantCount: readPositiveInteger(value.variantCount),
    preview: readPreview(value.preview),
  } satisfies FontCatalogItem;
}

export async function listFontCatalog() {
  const snapshot = await getDocs(collection(firebaseDb, 'fonts'));

  return snapshot.docs
    .map((documentSnapshot) =>
      readFont(
        documentSnapshot.id,
        documentSnapshot.data() as FontCatalogDocument,
      ),
    )
    .filter((font): font is FontCatalogItem => font !== null)
    .sort((left, right) =>
      left.sortName.localeCompare(right.sortName, undefined, {
        sensitivity: 'base',
      }),
    );
}

export async function listFontVariants(font: FontCatalogItem) {
  const snapshot = await getDocs(
    collection(firebaseDb, 'fonts', font.id, 'files'),
  );

  return snapshot.docs
    .map((documentSnapshot) => {
      const value = documentSnapshot.data() as FontFileDocument;

      if (
        value.enabled !== true ||
        value.kind !== 'font' ||
        typeof value.fileName !== 'string' ||
        typeof value.relativePath !== 'string' ||
        typeof value.storagePath !== 'string' ||
        !value.storagePath.startsWith('media/private/fonts/') ||
        typeof value.extension !== 'string'
      ) {
        return null;
      }

      return {
        id: documentSnapshot.id,
        contentType:
          typeof value.contentType === 'string'
            ? value.contentType
            : `font/${value.extension}`,
        extension: value.extension,
        fileName: value.fileName,
        relativePath: value.relativePath,
        storagePath: value.storagePath,
      } satisfies FontVariant;
    })
    .filter((variant): variant is FontVariant => variant !== null)
    .sort((left, right) =>
      left.relativePath.localeCompare(right.relativePath, undefined, {
        sensitivity: 'base',
      }),
    );
}

export async function loadFontVariant(
  font: FontCatalogItem,
  variant: FontVariant,
) {
  const loadKey = `${font.id}:${variant.id}`;
  const existingLoad = fontLoads.get(loadKey);

  if (existingLoad !== undefined) return existingLoad;

  const load = (async () => {
    const familyName = `strange-animals-font-${font.id}-${variant.id}`;
    const bytes = await getBytes(
      ref(firebaseStorage, variant.storagePath),
      MAX_PREVIEW_SIZE_BYTES,
    );
    const fontFace = new FontFace(familyName, bytes, {display: 'swap'});

    await fontFace.load();
    document.fonts.add(fontFace);

    return familyName;
  })();

  fontLoads.set(loadKey, load);
  load.catch(() => {
    fontLoads.delete(loadKey);
  });

  return load;
}

export async function downloadFontVariant(variant: FontVariant) {
  const bytes = await getBytes(
    ref(firebaseStorage, variant.storagePath),
    MAX_PREVIEW_SIZE_BYTES,
  );
  const blob = new Blob([bytes], {
    type: variant.contentType,
  });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = downloadUrl;
  anchor.download = variant.fileName;
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(downloadUrl);
  }, 0);
}

function isMissingStorageObject(error: unknown) {
  return isRecord(error) && error.code === 'storage/object-not-found';
}

export async function deleteFontCatalogItem(font: FontCatalogItem) {
  const filesSnapshot = await getDocs(
    collection(firebaseDb, 'fonts', font.id, 'files'),
  );
  const storagePaths = [
    ...new Set(
      filesSnapshot.docs
        .map((fileDocument) => fileDocument.data().storagePath)
        .filter(
          (storagePath): storagePath is string =>
            typeof storagePath === 'string' &&
            storagePath.startsWith('media/private/fonts/'),
        ),
    ),
  ];

  for (
    let index = 0;
    index < storagePaths.length;
    index += DELETE_CONCURRENCY
  ) {
    await Promise.all(
      storagePaths
        .slice(index, index + DELETE_CONCURRENCY)
        .map(async (storagePath) => {
          try {
            await deleteObject(ref(firebaseStorage, storagePath));
          } catch (error: unknown) {
            if (!isMissingStorageObject(error)) throw error;
          }
        }),
    );
  }

  for (
    let index = 0;
    index < filesSnapshot.docs.length;
    index += FIRESTORE_BATCH_SIZE
  ) {
    const batch = writeBatch(firebaseDb);

    for (const fileDocument of filesSnapshot.docs.slice(
      index,
      index + FIRESTORE_BATCH_SIZE,
    )) {
      batch.delete(fileDocument.ref);
    }

    await batch.commit();
  }

  await deleteDoc(doc(firebaseDb, 'fonts', font.id));

  for (const loadKey of fontLoads.keys()) {
    if (loadKey.startsWith(`${font.id}:`)) fontLoads.delete(loadKey);
  }
}
