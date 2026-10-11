import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";

const PROJECT_ID = "strange-animals-web";
const STORAGE_ROOT = "media/private/fonts";
const LOCAL_ROOT = path.resolve("fonts to upload");
const GCLOUD = "/Users/matiasespina/Downloads/google-cloud-sdk/bin/gcloud";
const FONT_EXTENSIONS = new Set([".otf", ".ttf", ".woff", ".woff2"]);

function slugify(value) {
  return value
    .replaceAll(/[™®©]/g, "")
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036F]/g, "")
    .toLowerCase()
    .replaceAll("&", " and ")
    .replaceAll(/[^a-z\d]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}

function getFileId(relativePath) {
  const baseSlug = slugify(relativePath.replace(/\.[^/.]+$/, "")) || "file";
  const hash = createHash("sha256")
    .update(relativePath)
    .digest("hex")
    .slice(0, 10);

  return `${baseSlug.slice(0, 80)}-${hash}`;
}

async function walkFonts(directory, relativePath = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === ".DS_Store") continue;

    const nextRelativePath = path.join(relativePath, entry.name);

    if (entry.isDirectory()) {
      files.push(
        ...(await walkFonts(path.join(directory, entry.name), nextRelativePath)),
      );
    } else if (
      entry.isFile() &&
      FONT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
    ) {
      files.push(nextRelativePath.replaceAll(path.sep, "/"));
    }
  }

  return files;
}

function runGcloud(arguments_) {
  return execFileSync(GCLOUD, arguments_, { encoding: "utf8" }).trim();
}

const entries = await readdir(LOCAL_ROOT, { withFileTypes: true });
const localFontPaths = [];

for (const entry of entries) {
  if (entry.name === "_alreadyUploaded" || entry.name === ".DS_Store") {
    continue;
  }

  if (entry.isDirectory()) {
    localFontPaths.push(
      ...(await walkFonts(path.join(LOCAL_ROOT, entry.name), entry.name)),
    );
  } else if (
    entry.isFile() &&
    FONT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
  ) {
    localFontPaths.push(`${path.parse(entry.name).name}/${entry.name}`);
  }
}

const expectedStoragePaths = localFontPaths
  .map((filePath) => `${STORAGE_ROOT}/${filePath}`)
  .sort();
const token = runGcloud(["auth", "print-access-token"]);
const firestoreBase = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function documentExists(documentPath) {
  const response = await fetch(`${firestoreBase}/${documentPath}`, {
    headers: { authorization: `Bearer ${token}` },
  });

  if (response.status === 404) return false;
  if (!response.ok) {
    throw new Error(
      `Firestore audit failed (${response.status}) for ${documentPath}: ${await response.text()}`,
    );
  }

  return true;
}

async function storageObjectExists(storagePath) {
  const bucket = `${PROJECT_ID}.firebasestorage.app`;
  const response = await fetch(
    `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(storagePath)}`,
    { headers: { authorization: `Bearer ${token}` } },
  );

  if (response.status === 404) return false;
  if (!response.ok) {
    throw new Error(
      `Storage audit failed (${response.status}) for ${storagePath}: ${await response.text()}`,
    );
  }

  return true;
}

async function checkAll(paths, exists) {
  const missing = [];
  let nextIndex = 0;
  const workerCount = Math.min(20, paths.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < paths.length) {
        const index = nextIndex++;
        const documentPath = paths[index];
        if (!(await exists(documentPath))) missing.push(documentPath);
      }
    }),
  );

  return missing.sort();
}

const firestoreFilePaths = localFontPaths.map((localPath) => {
  const [sourceFolder, ...relativeSegments] = localPath.split("/");
  const relativePath = relativeSegments.join("/");
  return `fonts/${slugify(sourceFolder)}/files/${getFileId(relativePath)}`;
});
const firestoreParentPaths = [
  ...new Set(
    localFontPaths.map((localPath) => {
      const [sourceFolder] = localPath.split("/");
      return `fonts/${slugify(sourceFolder)}`;
    }),
  ),
];
const [missingStorage, missingFirestoreDocuments, missingFirestoreParents] =
  await Promise.all([
    checkAll(expectedStoragePaths, storageObjectExists),
    checkAll(firestoreFilePaths, documentExists),
    checkAll(firestoreParentPaths, documentExists),
  ]);
const missingFirestore = missingFirestoreDocuments;

console.log(
  JSON.stringify(
    {
      localFontFiles: expectedStoragePaths.length,
      missingFirestore,
      missingFirestoreParents,
      missingStorage,
      passed:
        missingStorage.length === 0 &&
        missingFirestore.length === 0 &&
        missingFirestoreParents.length === 0,
    },
    null,
    2,
  ),
);

if (
  missingStorage.length > 0 ||
  missingFirestore.length > 0 ||
  missingFirestoreParents.length > 0
) {
  process.exitCode = 1;
}
