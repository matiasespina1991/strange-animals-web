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
} from "firebase/firestore";
import { deleteObject, getBytes, ref } from "firebase/storage";
import { firebaseDb, firebaseStorage } from "@/lib/firebase";

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
  kind: "collection" | "family";
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

export type LoadedFontVariant = {
  familyName: string;
  supportedCodePoints: ReadonlySet<number> | null;
};

const fontLoads = new Map<string, Promise<LoadedFontVariant>>();
const FONT_FORMAT_PRIORITY: Record<string, number> = {
  otf: 4,
  woff2: 3,
  woff: 2,
  ttf: 1,
};

function isWithinBounds(view: DataView, offset: number, length: number) {
  return offset >= 0 && length >= 0 && offset + length <= view.byteLength;
}

function toUint16(value: number) {
  return ((value % 65_536) + 65_536) % 65_536;
}

function addFormat4CodePoints(
  view: DataView,
  offset: number,
  end: number,
  codePoints: Set<number>,
) {
  if (!isWithinBounds(view, offset, 16) || offset + 16 > end) return;

  const formatLength = view.getUint16(offset + 2);
  const tableEnd = Math.min(end, offset + formatLength);
  const segmentCount = view.getUint16(offset + 6) / 2;
  const endCodesOffset = offset + 14;
  const startCodesOffset = endCodesOffset + segmentCount * 2 + 2;
  const deltasOffset = startCodesOffset + segmentCount * 2;
  const rangeOffsetsOffset = deltasOffset + segmentCount * 2;

  if (
    !Number.isInteger(segmentCount) ||
    !isWithinBounds(view, endCodesOffset, segmentCount * 2) ||
    !isWithinBounds(view, startCodesOffset, segmentCount * 2) ||
    !isWithinBounds(view, deltasOffset, segmentCount * 2) ||
    !isWithinBounds(view, rangeOffsetsOffset, segmentCount * 2) ||
    rangeOffsetsOffset + segmentCount * 2 > tableEnd
  ) {
    return;
  }

  for (let index = 0; index < segmentCount; index += 1) {
    const start = view.getUint16(startCodesOffset + index * 2);
    const finish = view.getUint16(endCodesOffset + index * 2);
    const delta = view.getInt16(deltasOffset + index * 2);
    const rangeOffsetEntry = rangeOffsetsOffset + index * 2;
    const rangeOffset = view.getUint16(rangeOffsetEntry);

    if (start > finish) continue;

    for (let codePoint = start; codePoint <= finish; codePoint += 1) {
      if (codePoint === 65_535) continue;

      let glyphIndex: number;
      if (rangeOffset === 0) {
        glyphIndex = toUint16(codePoint + delta);
      } else {
        const glyphIndexOffset =
          rangeOffsetEntry + rangeOffset + (codePoint - start) * 2;

        if (
          !isWithinBounds(view, glyphIndexOffset, 2) ||
          glyphIndexOffset + 2 > tableEnd
        ) {
          continue;
        }

        glyphIndex = view.getUint16(glyphIndexOffset);
        if (glyphIndex !== 0) glyphIndex = toUint16(glyphIndex + delta);
      }

      if (glyphIndex !== 0) codePoints.add(codePoint);
    }
  }
}

function addFormat12CodePoints(
  view: DataView,
  offset: number,
  end: number,
  codePoints: Set<number>,
) {
  if (!isWithinBounds(view, offset, 16) || offset + 16 > end) return;

  const formatLength = view.getUint32(offset + 4);
  const tableEnd = Math.min(end, offset + formatLength);
  const groupCount = view.getUint32(offset + 12);
  const groupsOffset = offset + 16;

  if (
    !isWithinBounds(view, groupsOffset, groupCount * 12) ||
    groupsOffset + groupCount * 12 > tableEnd
  ) {
    return;
  }

  for (let index = 0; index < groupCount; index += 1) {
    const groupOffset = groupsOffset + index * 12;
    const start = view.getUint32(groupOffset);
    const finish = view.getUint32(groupOffset + 4);
    const glyphStart = view.getUint32(groupOffset + 8);

    if (start > finish || start > 1_114_111) continue;

    for (
      let codePoint = start;
      codePoint <= Math.min(finish, 1_114_111);
      codePoint += 1
    ) {
      if (glyphStart + codePoint - start !== 0) codePoints.add(codePoint);
    }
  }
}

function getSupportedCodePoints(bytes: Uint8Array) {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    if (!isWithinBounds(view, 0, 12)) return null;

    const tableCount = view.getUint16(4);
    const recordsOffset = 12;
    if (!isWithinBounds(view, recordsOffset, tableCount * 16)) return null;

    for (let index = 0; index < tableCount; index += 1) {
      const recordOffset = recordsOffset + index * 16;
      const tag = String.fromCharCode(
        view.getUint8(recordOffset),
        view.getUint8(recordOffset + 1),
        view.getUint8(recordOffset + 2),
        view.getUint8(recordOffset + 3),
      );

      if (tag !== "cmap") continue;

      const cmapOffset = view.getUint32(recordOffset + 8);
      const cmapLength = view.getUint32(recordOffset + 12);
      const cmapEnd = cmapOffset + cmapLength;
      if (!isWithinBounds(view, cmapOffset, 4) || cmapEnd > view.byteLength)
        return null;

      const encodingCount = view.getUint16(cmapOffset + 2);
      const encodingsOffset = cmapOffset + 4;
      if (!isWithinBounds(view, encodingsOffset, encodingCount * 8))
        return null;

      const codePoints = new Set<number>();
      for (let encoding = 0; encoding < encodingCount; encoding += 1) {
        const encodingOffset = encodingsOffset + encoding * 8;
        const subtableOffset = cmapOffset + view.getUint32(encodingOffset + 4);
        if (
          !isWithinBounds(view, subtableOffset, 2) ||
          subtableOffset >= cmapEnd
        ) {
          continue;
        }

        const format = view.getUint16(subtableOffset);
        if (format === 4) {
          addFormat4CodePoints(view, subtableOffset, cmapEnd, codePoints);
        } else if (format === 12) {
          addFormat12CodePoints(view, subtableOffset, cmapEnd, codePoints);
        }
      }

      return codePoints.size > 0 ? codePoints : null;
    }
  } catch {
    return null;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readPositiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : 0;
}

function readPreview(value: unknown) {
  if (!isRecord(value)) return null;

  const preview = value as FontPreviewDocument;

  if (
    typeof preview.fileName !== "string" ||
    typeof preview.format !== "string" ||
    typeof preview.storagePath !== "string" ||
    !preview.storagePath.startsWith("media/private/fonts/")
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
  if (typeof value.name !== "string") return null;

  const enabled = value.enabled === true;

  if (!import.meta.env.DEV && !enabled) return null;

  const displayName =
    typeof value.displayName === "string" && value.displayName.trim()
      ? value.displayName.trim()
      : value.name;
  const storedParentCategory =
    typeof value.parentCategory === "string" && value.parentCategory.trim()
      ? value.parentCategory.trim()
      : null;
  const parentCategory =
    storedParentCategory === "Tridimensional"
      ? "3D"
      : storedParentCategory === "Squared"
        ? "Squared / Tech"
        : storedParentCategory === "Standard"
          ? "Paragraph / Standard"
          : storedParentCategory === "Bold"
            ? "Title / Bold"
            : storedParentCategory;
  const storedUseCases = Array.isArray(value.useCases)
    ? value.useCases.filter(
        (useCase): useCase is string =>
          typeof useCase === "string" && useCase.trim().length > 0,
      )
    : [];
  const legacyUseCase =
    typeof value.useCase === "string" && value.useCase.trim()
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
      typeof value.sortName === "string"
        ? value.sortName
        : displayName.toLocaleLowerCase(),
    kind: value.kind === "collection" ? "collection" : "family",
    formats: Array.isArray(value.formats)
      ? value.formats.filter(
          (format): format is string => typeof format === "string",
        )
      : [],
    fileCount: readPositiveInteger(value.fileCount),
    variantCount: readPositiveInteger(value.variantCount),
    preview: readPreview(value.preview),
  } satisfies FontCatalogItem;
}

export async function listFontCatalog() {
  const fontsReference = collection(firebaseDb, "fonts");
  const snapshot = await getDocs(
    import.meta.env.DEV
      ? fontsReference
      : query(fontsReference, where("enabled", "==", true)),
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
        sensitivity: "base",
      }),
    );
}

export async function updateFontParentCategory(
  font: FontCatalogItem,
  parentCategory: string | null,
) {
  await updateDoc(doc(firebaseDb, "fonts", font.id), {
    parentCategory: parentCategory ?? deleteField(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateFontEnabled(
  font: FontCatalogItem,
  enabled: boolean,
) {
  await updateDoc(doc(firebaseDb, "fonts", font.id), {
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

  await updateDoc(doc(firebaseDb, "fonts", font.id), {
    useCase: deleteField(),
    useCases: normalizedUseCases,
    updatedAt: serverTimestamp(),
  });
}

export async function listFontVariants(font: FontCatalogItem) {
  const snapshot = await getDocs(
    collection(firebaseDb, "fonts", font.id, "files"),
  );

  const variants = snapshot.docs
    .map((documentSnapshot) => {
      const value = documentSnapshot.data() as FontFileDocument;

      if (
        value.enabled !== true ||
        value.kind !== "font" ||
        typeof value.fileName !== "string" ||
        typeof value.relativePath !== "string" ||
        typeof value.storagePath !== "string" ||
        !value.storagePath.startsWith("media/private/fonts/") ||
        typeof value.extension !== "string"
      ) {
        return null;
      }

      return {
        id: documentSnapshot.id,
        contentType:
          typeof value.contentType === "string"
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
      .replace(/\.[^/.]+$/, "")
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
        sensitivity: "base",
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
    const fontFace = new FontFace(familyName, bytes, { display: "swap" });

    await fontFace.load();
    document.fonts.add(fontFace);

    return {
      familyName,
      supportedCodePoints: getSupportedCodePoints(bytes),
    };
  })();

  fontLoads.set(loadKey, load);
  load.catch(() => {
    fontLoads.delete(loadKey);
  });

  return load;
}

export async function downloadFontFamily(font: FontCatalogItem) {
  const { default: JSZip } = await import("jszip");
  const snapshot = await getDocs(
    collection(firebaseDb, "fonts", font.id, "files"),
  );
  const files = snapshot.docs
    .map((documentSnapshot) => documentSnapshot.data() as FontFileDocument)
    .filter(
      (file) =>
        file.enabled === true &&
        typeof file.relativePath === "string" &&
        !file.relativePath.startsWith("/") &&
        !file.relativePath.split("/").includes("..") &&
        typeof file.storagePath === "string" &&
        file.storagePath.startsWith("media/private/fonts/"),
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
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = downloadUrl;
  anchor.download = `${font.id}.zip`;
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(downloadUrl);
  }, 0);
}

function isMissingStorageObject(error: unknown) {
  return isRecord(error) && error.code === "storage/object-not-found";
}

export async function deleteFontCatalogItem(font: FontCatalogItem) {
  const filesSnapshot = await getDocs(
    collection(firebaseDb, "fonts", font.id, "files"),
  );
  const storagePaths = [
    ...new Set(
      filesSnapshot.docs
        .map((fileDocument) => fileDocument.data().storagePath)
        .filter(
          (storagePath): storagePath is string =>
            typeof storagePath === "string" &&
            storagePath.startsWith("media/private/fonts/"),
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

  await deleteDoc(doc(firebaseDb, "fonts", font.id));

  for (const loadKey of fontLoads.keys()) {
    if (loadKey.startsWith(`${font.id}:`)) fontLoads.delete(loadKey);
  }
}
