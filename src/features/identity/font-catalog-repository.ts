/* eslint-disable no-await-in-loop -- Destructive Storage and Firestore batches are intentionally bounded and sequential. */
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  getDoc,
  serverTimestamp,
  updateDoc,
  writeBatch,
  getFirestore,
} from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";
import { FontLoadQueue } from "./font-load-queue";
import { visibleFontCatalog } from "./font-catalog-visibility";
import { logFontLoad, traceFontLoad } from "./font-load-diagnostics";
import {
  readFontBytes,
  type FontDownloadProgress,
} from "./font-download-progress";
import { firebaseAuth, firebaseDb, firebaseStorage } from "@/lib/firebase";
import { accountAuth } from "./account-auth";
import { getStorage } from "firebase/storage";
import {
  canUseLocalFontUseCase,
  hasLocalFontUseCase,
  setLocalFontUseCase,
  LOCAL_FONT_USE_CASE,
} from "./local-font-use-case";

// Large Japanese/color fonts exceed 20 MiB even after a valid OTF reexport.
const MAX_PREVIEW_SIZE_BYTES = 64 * 1024 * 1024;
const DELETE_CONCURRENCY = 8;
const FIRESTORE_BATCH_SIZE = 450;

function fontReadContext() {
  const account = accountAuth.currentUser;
  return account
    ? {
        database: getFirestore(accountAuth.app),
        storage: getStorage(accountAuth.app),
        user: account,
      }
    : {
        database: firebaseDb,
        storage: firebaseStorage,
        user: firebaseAuth.currentUser,
      };
}

export async function renameFontFamily(font: FontCatalogItem, name: string) {
  if (!import.meta.env.DEV) throw new Error("Development only");
  const value = name.trim();
  if (!value || value.length > 200)
    throw new Error("El nombre debe tener entre 1 y 200 caracteres.");
  await updateDoc(doc(firebaseDb, "fonts", font.id), {
    name: value,
    displayName: value,
    sortName: value.toLowerCase(),
    updatedAt: serverTimestamp(),
  });
}

export async function duplicateFontFamily(font: FontCatalogItem) {
  if (!import.meta.env.DEV) throw new Error("Development only");
  const source = await getDoc(doc(firebaseDb, "fonts", font.id));
  if (!source.exists()) throw new Error("Family no longer exists");
  const files = await getDocs(
    collection(firebaseDb, "fonts", font.id, "files"),
  );
  if (!files.size || files.size >= FIRESTORE_BATCH_SIZE)
    throw new Error("Unsupported family size");
  const target = doc(collection(firebaseDb, "fonts"));
  const prefix = `media/private/fonts/copies/${target.id}`;
  const paths = new Map<string, string>();
  const uploaded: string[] = [];
  const copies: { id: string; data: Record<string, unknown> }[] = [];
  try {
    for (const file of files.docs) {
      const data = file.data();
      if (
        typeof data.storagePath !== "string" ||
        !data.storagePath.startsWith("media/private/fonts/")
      )
        throw new Error("Invalid font path");
      const destination = `${prefix}/${file.id}/${data.fileName}`;
      const bytes = await getBytes(ref(firebaseStorage, data.storagePath));
      if (bytes.byteLength === 0) {
        console.warn("[FontCatalog/duplicate] Skipping empty file", {
          fontId: font.id,
          fileId: file.id,
          storagePath: data.storagePath,
        });
        continue;
      }
      await uploadBytes(ref(firebaseStorage, destination), bytes, {
        contentType: data.contentType ?? "application/octet-stream",
      });
      uploaded.push(destination);
      paths.set(data.storagePath, destination);
      copies.push({
        id: file.id,
        data: {
          ...data,
          id: file.id,
          fontId: target.id,
          storagePath: destination,
          sizeBytes: bytes.byteLength,
          updatedAt: serverTimestamp(),
        },
      });
    }
    if (copies.length === 0)
      throw new Error("This family has no non-empty files to duplicate.");
    const original = source.data();
    const name = `${font.name.slice(0, 195)} copy`;
    const previewFiles = copies.filter(
      (file) =>
        file.data.kind === "font" ||
        ["otf", "ttf", "woff", "woff2"].includes(String(file.data.extension)),
    );
    const preferredPath = original.preview?.storagePath
      ? paths.get(original.preview.storagePath)
      : undefined;
    const previewFile =
      previewFiles.find((file) => file.data.storagePath === preferredPath) ??
      previewFiles[0];
    const parentData = {
      ...original,
      id: target.id,
      sourceFontId: font.id,
      name,
      displayName: name,
      sortName: name.toLowerCase(),
      storagePrefix: prefix,
      enabled: typeof original.enabled === "boolean" ? original.enabled : true,
      fileCount: copies.length,
      variantCount: previewFiles.length,
      preview: previewFile
        ? {
            fileName: previewFile.data.fileName,
            format: previewFile.data.extension,
            storagePath: previewFile.data.storagePath,
          }
        : null,
      updatedAt: serverTimestamp(),
    };
    // Bound source-document reads to the rules' per-batch access-call limit.
    for (let index = 0; index < copies.length; index += 10) {
      const batch = writeBatch(firebaseDb);
      if (index === 0) batch.set(target, parentData);
      for (const file of copies.slice(index, index + 10)) {
        batch.set(doc(target, "files", file.id), file.data);
      }
      await batch.commit();
    }
  } catch (error) {
    await Promise.allSettled(
      copies.map((file) => deleteDoc(doc(target, "files", file.id))),
    );
    await Promise.allSettled([deleteDoc(target)]);
    await Promise.allSettled(
      uploaded.map((path) => deleteObject(ref(firebaseStorage, path))),
    );
    throw error;
  }
}

type FontPreviewDocument = {
  fileName?: unknown;
  format?: unknown;
  storagePath?: unknown;
};

type FontCatalogDocument = {
  previewString?: unknown;
  displayName?: unknown;
  enabled?: unknown;
  fileCount?: unknown;
  formats?: unknown;
  kind?: unknown;
  name?: unknown;
  parentCategory?: unknown;
  previewLineHeightExtraRem?: unknown;
  previewLineHeightExtra?: unknown;
  previewLetterSpacingExtraEm?: unknown;
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
  previewEnabled?: unknown;
  storagePath?: unknown;
};

export type FontCatalogItem = {
  previewString?: string;
  enabled: boolean;
  id: string;
  name: string;
  parentCategory: string | null;
  previewLineHeightExtraRem?: number;
  previewLineHeightExtra?: number;
  previewLetterSpacingExtraEm?: number;
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
  previewEnabled: boolean;
  storagePath: string;
};

export type LoadedFontVariant = {
  familyName: string;
  supportedCodePoints: ReadonlySet<number> | null;
};

const fontLoads = new FontLoadQueue<LoadedFontVariant>(3, logFontLoad);
export const reserveFontLoad = (priority: () => number) =>
  fontLoads.reserve(priority);
export const refreshFontLoadPriorities = () => fontLoads.refresh();
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

function readFont(
  id: string,
  value: FontCatalogDocument,
): FontCatalogItem | null {
  if (typeof value.name !== "string") return null;

  const enabled = value.enabled === true;

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
    previewString:
      typeof value.previewString === "string" ? value.previewString : "",
    parentCategory,
    previewLetterSpacingExtraEm:
      typeof value.previewLetterSpacingExtraEm === "number" &&
      Number.isFinite(value.previewLetterSpacingExtraEm) &&
      value.previewLetterSpacingExtraEm >= 0
        ? value.previewLetterSpacingExtraEm
        : 0,
    previewLineHeightExtra:
      typeof value.previewLineHeightExtra === "number" &&
      Number.isFinite(value.previewLineHeightExtra) &&
      value.previewLineHeightExtra >= 0
        ? value.previewLineHeightExtra
        : 0,
    previewLineHeightExtraRem:
      typeof value.previewLineHeightExtraRem === "number" &&
      Number.isFinite(value.previewLineHeightExtraRem) &&
      value.previewLineHeightExtraRem >= 0
        ? value.previewLineHeightExtraRem
        : 0,
    useCases: [
      ...(hasLocalFontUseCase(id) ? [LOCAL_FONT_USE_CASE] : []),
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
  const fontsReference = collection(fontReadContext().database, "fonts");
  const snapshot = await getDocs(fontsReference);

  return visibleFontCatalog(snapshot.docs
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
    ), typeof window === "undefined" ? "" : window.location.hostname);
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

export async function updateFontVariantPreviewEnabled(
  font: FontCatalogItem,
  variant: FontVariant,
  previewEnabled: boolean,
) {
  await updateDoc(doc(firebaseDb, "fonts", font.id, "files", variant.id), {
    previewEnabled,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteFontVariant(
  font: FontCatalogItem,
  variant: FontVariant,
) {
  try {
    await deleteObject(ref(firebaseStorage, variant.storagePath));
  } catch (error: unknown) {
    if (!isMissingStorageObject(error)) throw error;
  }

  await deleteDoc(doc(firebaseDb, "fonts", font.id, "files", variant.id));
  fontLoads.delete(`${font.id}:${variant.id}`);
}

export async function updateFontUseCases(
  font: FontCatalogItem,
  useCases: string[],
) {
  const normalizedUseCases = [
    ...new Set(useCases.map((useCase) => useCase.trim())),
  ]
    .filter((useCase) => Boolean(useCase) && useCase !== LOCAL_FONT_USE_CASE)
    .slice(0, 3);

  const publicUseCases = font.useCases.filter(
    (useCase) => useCase !== LOCAL_FONT_USE_CASE,
  );
  if (JSON.stringify(normalizedUseCases) !== JSON.stringify(publicUseCases)) {
    await updateDoc(doc(firebaseDb, "fonts", font.id), {
      useCase: deleteField(),
      useCases: normalizedUseCases,
      updatedAt: serverTimestamp(),
    });
  }
  if (canUseLocalFontUseCase())
    setLocalFontUseCase(font.id, useCases.includes(LOCAL_FONT_USE_CASE));
}

export async function listFontVariants(font: FontCatalogItem) {
  const { database } = fontReadContext();
  const snapshot = await getDocs(
    collection(database, "fonts", font.id, "files"),
  );

  const variants = snapshot.docs
    .map((documentSnapshot) => {
      const value = documentSnapshot.data() as FontFileDocument;

      if (
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
        previewEnabled: value.previewEnabled !== false,
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
  signal?: AbortSignal,
  onProgress?: (progress: FontDownloadProgress) => void,
  priority?: () => number,
) {
  const loadKey = `${font.id}:${variant.id}`;
  const trace = traceFontLoad({
    fontId: font.id,
    fontName: font.name,
    variantId: variant.id,
    storagePath: variant.storagePath,
  });
  trace.event("queued");
  let lastProgressBucket = -1;
  return fontLoads
    .load(
      loadKey,
      async (downloadSignal, reportProgress) => {
        reportProgress({ phase: "downloading", loaded: 0, total: null });
        const familyName = `strange-animals-font-${font.id}-${variant.id}`;
        const context = fontReadContext();
        const location = ref(context.storage, variant.storagePath);
        trace.event("auth:waiting");
        const token = await context.user?.getIdToken();
        trace.event("download:request", { authenticated: Boolean(token) });
        downloadSignal.throwIfAborted();
        // Same authenticated media endpoint as the Storage SDK, with native cancellation.
        // Do not create public download tokens for private font objects.
        const url = `https://firebasestorage.googleapis.com/v0/b/${location.bucket}/o/${encodeURIComponent(location.fullPath)}?alt=media`;
        const response = await fetch(url, {
          signal: downloadSignal,
          headers: token ? { Authorization: `Firebase ${token}` } : {},
        });
        trace.event("download:headers", {
          status: response.status,
          contentType: response.headers.get("content-type"),
          contentLength: response.headers.get("content-length"),
        });
        if (!response.ok)
          throw new Error(`Font download failed (${response.status})`);
        trace.event("download:body");
        const bytes = await readFontBytes(
          response,
          downloadSignal,
          MAX_PREVIEW_SIZE_BYTES,
          (progress) => {
            reportProgress(progress);
            const bucket = progress.total
              ? Math.floor((progress.loaded / progress.total) * 4)
              : -1;
            if (bucket !== lastProgressBucket) {
              lastProgressBucket = bucket;
              // Keep the body-stage watchdog running; progress logs must not reset it.
              trace.event("download:body", {
                loadedBytes: progress.loaded,
                totalBytes: progress.total,
              });
            }
          },
        );
        trace.event("decode:fontface", { bytes: bytes.byteLength });
        downloadSignal.throwIfAborted();
        reportProgress({
          phase: "decoding",
          loaded: bytes.byteLength,
          total: bytes.byteLength,
        });
        const fontFace = new FontFace(familyName, bytes, { display: "swap" });

        await fontFace.load();
        downloadSignal.throwIfAborted();
        document.fonts.add(fontFace);
        trace.event("decode:registered", { status: fontFace.status });

        return {
          familyName,
          supportedCodePoints: getSupportedCodePoints(bytes),
        };
      },
      signal,
      onProgress,
      priority,
    )
    .then(
      (value) => {
        trace.finish("ready");
        return value;
      },
      (error) => {
        trace.finish(
          signal?.aborted ||
            (error instanceof DOMException && error.name === "AbortError")
            ? "cancelled"
            : "failed",
          error,
        );
        throw error;
      },
    );
}

export async function downloadFontFamily(font: FontCatalogItem) {
  const { default: JSZip } = await import("jszip");
  const context = fontReadContext();
  const snapshot = await getDocs(
    collection(context.database, "fonts", font.id, "files"),
  );
  const files = snapshot.docs
    .map((documentSnapshot) => documentSnapshot.data() as FontFileDocument)
    .filter(
      (file) =>
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
      const bytes = await getBytes(ref(context.storage, file.storagePath));

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
