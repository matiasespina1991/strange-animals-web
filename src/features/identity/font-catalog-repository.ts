/* eslint-disable no-await-in-loop -- Destructive Storage and Firestore batches are intentionally bounded and sequential. */
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
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
  parentCategory?: unknown;
  preview?: unknown;
  sortName?: unknown;
  useCase?: unknown;
  useCases?: unknown;
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
  enabled: boolean;
  id: string;
  name: string;
  parentCategory: string | null;
  useCases: string[];
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
const FONT_FORMAT_PRIORITY: Record<string, number> = {
  otf: 4,
  woff2: 3,
  woff: 2,
  ttf: 1,
};

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
  if (typeof value.name !== 'string') return null;

  const enabled = value.enabled === true;

  if (!import.meta.env.DEV && !enabled) return null;

  const displayName =
    typeof value.displayName === 'string' && value.displayName.trim()
      ? value.displayName.trim()
      : value.name;
  const storedParentCategory =
    typeof value.parentCategory === 'string' && value.parentCategory.trim()
      ? value.parentCategory.trim()
      : null;
  const parentCategory =
    storedParentCategory === 'Squared'
      ? 'Squared / Tech'
      : storedParentCategory === 'Standard'
        ? 'Paragraph / Standard'
        : storedParentCategory === 'Bold'
          ? 'Title / Bold'
          : storedParentCategory;
  const storedUseCases = Array.isArray(value.useCases)
    ? value.useCases.filter(
        (useCase): useCase is string =>
          typeof useCase === 'string' && useCase.trim().length > 0,
      )
    : [];
  const legacyUseCase =
    typeof value.useCase === 'string' && value.useCase.trim()
      ? value.useCase.trim()
      : null;

  return {
    enabled,
    id,
    name: displayName,
    parentCategory,
    useCases: [
      ...new Set(
        storedUseCases.length > 0
          ? storedUseCases
          : legacyUseCase
            ? [legacyUseCase]
            : [],
      ),
    ],
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
  const fontsReference = collection(firebaseDb, 'fonts');
  const snapshot = await getDocs(
    import.meta.env.DEV
      ? fontsReference
      : query(fontsReference, where('enabled', '==', true)),
  );

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

export async function updateFontParentCategory(
  font: FontCatalogItem,
  parentCategory: string | null,
) {
  await updateDoc(doc(firebaseDb, 'fonts', font.id), {
    parentCategory: parentCategory ?? deleteField(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateFontEnabled(
  font: FontCatalogItem,
  enabled: boolean,
) {
  await updateDoc(doc(firebaseDb, 'fonts', font.id), {
    enabled,
    updatedAt: serverTimestamp(),
  });
}

export async function updateFontUseCases(
  font: FontCatalogItem,
  useCases: string[],
) {
  const normalizedUseCases = [
    ...new Set(useCases.map((useCase) => useCase.trim())),
  ]
    .filter(Boolean)
    .slice(0, 3);

  await updateDoc(doc(firebaseDb, 'fonts', font.id), {
    useCase: deleteField(),
    useCases: normalizedUseCases,
    updatedAt: serverTimestamp(),
  });
}

export async function listFontVariants(font: FontCatalogItem) {
  const snapshot = await getDocs(
    collection(firebaseDb, 'fonts', font.id, 'files'),
  );

  const variants = snapshot.docs
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
    .filter((variant): variant is FontVariant => variant !== null);
  const variantsByStyle = new Map<string, FontVariant>();

  for (const variant of variants) {
    const styleKey = variant.relativePath
      .replace(/\.[^/.]+$/, '')
      .toLocaleLowerCase();
    const currentVariant = variantsByStyle.get(styleKey);

    if (
      !currentVariant ||
      (FONT_FORMAT_PRIORITY[variant.extension.toLocaleLowerCase()] ?? 0) >
        (FONT_FORMAT_PRIORITY[currentVariant.extension.toLocaleLowerCase()] ??
          0)
    ) {
      variantsByStyle.set(styleKey, variant);
    }
  }

  return [...variantsByStyle.values()].sort(
    (left, right) =>
      (FONT_FORMAT_PRIORITY[right.extension.toLocaleLowerCase()] ?? 0) -
        (FONT_FORMAT_PRIORITY[left.extension.toLocaleLowerCase()] ?? 0) ||
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

export async function downloadFontFamily(font: FontCatalogItem) {
  const {default: JSZip} = await import('jszip');
  const snapshot = await getDocs(
    collection(firebaseDb, 'fonts', font.id, 'files'),
  );
  const files = snapshot.docs
    .map((documentSnapshot) => documentSnapshot.data() as FontFileDocument)
    .filter(
      (file) =>
        file.enabled === true &&
        typeof file.relativePath === 'string' &&
        !file.relativePath.startsWith('/') &&
        !file.relativePath.split('/').includes('..') &&
        typeof file.storagePath === 'string' &&
        file.storagePath.startsWith('media/private/fonts/'),
    );

  if (files.length === 0) throw new Error(`Font family ${font.id} is empty.`);

  const archive = new JSZip();

  await Promise.all(
    files.map(async (file) => {
      const bytes = await getBytes(ref(firebaseStorage, file.storagePath));

      archive.file(file.relativePath as string, bytes);
    }),
  );

  const blob = await archive.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: {level: 6},
  });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = downloadUrl;
  anchor.download = `${font.id}.zip`;
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
