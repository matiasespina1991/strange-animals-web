import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

const PROJECT_ID = "strange-animals-web";
const STORAGE_BUCKET = `${PROJECT_ID}.firebasestorage.app`;
const STORAGE_ROOT = "media/private/fonts";
const GCLOUD_CANDIDATE =
  "/Users/matiasespina/Downloads/google-cloud-sdk/bin/gcloud";
const GCLOUD = existsSync(GCLOUD_CANDIDATE) ? GCLOUD_CANDIDATE : "gcloud";
const FONT_EXTENSIONS = new Set(["otf", "ttf", "woff", "woff2"]);
const APPLY = process.argv.includes("--apply");
const STORAGE_LIST_PATH = readOption("--storage-list");

function readOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;

  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a file path`);
  }

  return value;
}

function runGcloud(arguments_, capture = false) {
  const result = spawnSync(GCLOUD, arguments_, {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`gcloud failed with exit code ${result.status ?? "unknown"}`);
  }

  return capture ? result.stdout.trim() : "";
}

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

function displayName(value) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replaceAll(/[-_]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function getExtension(path) {
  return path.split(".").at(-1)?.toLowerCase() ?? "";
}

function getContentType(extension) {
  return (
    {
      otf: "font/otf",
      ttf: "font/ttf",
      woff: "font/woff",
      woff2: "font/woff2",
    }[extension] ?? "application/octet-stream"
  );
}

function getFileId(relativePath) {
  const baseSlug = slugify(relativePath.replace(/\.[^/.]+$/, "")) || "file";
  const hash = createHash("sha256")
    .update(relativePath)
    .digest("hex")
    .slice(0, 10);

  return `${baseSlug.slice(0, 80)}-${hash}`;
}

function getStorageIdentity(storagePath) {
  const segments = storagePath.split("/");
  const sourceFolder = segments[3];
  const relativePath = segments.slice(4).join("/");

  return `${slugify(sourceFolder)}/${relativePath}`;
}

function encode(value) {
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return { integerValue: String(value) };
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map((item) => encode(item)) } };
  }

  return {
    mapValue: {
      fields: Object.fromEntries(
        Object.entries(value).map(([key, nestedValue]) => [
          key,
          encode(nestedValue),
        ]),
      ),
    },
  };
}

function encodeFields(data) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, encode(value)]),
  );
}

async function firestoreRequest(path, accessToken, options = {}) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/${path}`,
    {
      ...options,
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        ...options.headers,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Firestore request failed (${response.status}): ${await response.text()}`);
  }

  return response.json();
}

async function listParentIds(accessToken) {
  const ids = new Set();
  let pageToken = "";

  do {
    const query = new URLSearchParams({ pageSize: "1000" });
    if (pageToken) query.set("pageToken", pageToken);
    const result = await firestoreRequest(`documents/fonts?${query}`, accessToken);

    for (const document of result.documents ?? []) {
      ids.add(document.name.split("/").at(-1));
    }

    pageToken = result.nextPageToken ?? "";
  } while (pageToken);

  return ids;
}

async function listRegisteredFileIdentities(accessToken) {
  const result = await firestoreRequest("documents:runQuery", accessToken, {
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "files", allDescendants: true }],
      },
    }),
    method: "POST",
  });

  return new Set(
    result
      .map((entry) => entry.document?.fields?.storagePath?.stringValue)
      .filter((path) => typeof path === "string")
      .map((path) => getStorageIdentity(path)),
  );
}

function listStorageFontPaths() {
  const output = STORAGE_LIST_PATH
    ? readFileSync(STORAGE_LIST_PATH, "utf8")
    : runGcloud(
        ["storage", "ls", "--recursive", `gs://${STORAGE_BUCKET}/${STORAGE_ROOT}/`],
        true,
      );
  const prefix = `gs://${STORAGE_BUCKET}/`;

  return output
    .split("\n")
    .map((path) => path.trim())
    .filter(Boolean)
    .map((path) => (path.startsWith(prefix) ? path.slice(prefix.length) : path))
    .filter((path) => FONT_EXTENSIONS.has(getExtension(path)));
}

function buildFamilies(storagePaths, registeredFileIdentities, parentIds) {
  const families = new Map();

  for (const storagePath of storagePaths) {
    const segments = storagePath.split("/");
    const sourceFolder = segments[3];
    const relativePath = segments.slice(4).join("/");
    const fontId = slugify(sourceFolder);

    if (!sourceFolder || !relativePath || !fontId) continue;

    const family = families.get(sourceFolder) ?? {
      fontId,
      hasParent: parentIds.has(fontId),
      files: [],
      sourceFolder,
    };
    const extension = getExtension(relativePath);

    family.files.push({
      contentType: getContentType(extension),
      extension,
      fileName: relativePath.split("/").at(-1),
      id: getFileId(relativePath),
      relativePath,
      storagePath,
      registered: registeredFileIdentities.has(getStorageIdentity(storagePath)),
    });
    families.set(sourceFolder, family);
  }

  return [...families.values()]
    .map((family) => ({
      ...family,
      missingFiles: family.files.filter((file) => !file.registered),
    }))
    .filter((family) => family.missingFiles.length > 0)
    .sort((left, right) => left.sourceFolder.localeCompare(right.sourceFolder));
}

function formatPriority(extension) {
  return { otf: 4, woff2: 3, woff: 2, ttf: 1 }[extension] ?? 0;
}

function parentDocument(family) {
  const preview = [...family.files].sort(
    (left, right) =>
      formatPriority(right.extension) - formatPriority(left.extension) ||
      left.relativePath.localeCompare(right.relativePath),
  )[0];

  return {
    enabled: true,
    fileCount: family.files.length,
    formats: [...new Set(family.files.map((file) => file.extension))].sort(),
    id: family.fontId,
    kind: "family",
    name: displayName(family.sourceFolder),
    preview: {
      fileName: preview.fileName,
      format: preview.extension,
      storagePath: preview.storagePath,
    },
    sortName: displayName(family.sourceFolder).normalize("NFKD").toLowerCase(),
    sourceFolder: family.sourceFolder,
    storagePrefix: `${STORAGE_ROOT}/${family.sourceFolder}`,
    variantCount: family.files.length,
    version: 1,
  };
}

async function commitWrites(writes, accessToken) {
  for (let index = 0; index < writes.length; index += 450) {
    await firestoreRequest("documents:commit", accessToken, {
      body: JSON.stringify({ writes: writes.slice(index, index + 450) }),
      method: "POST",
    });
  }
}

const accessToken = runGcloud(["auth", "print-access-token"], true);
const [storagePaths, registeredFileIdentities, parentIds] = await Promise.all([
  Promise.resolve(listStorageFontPaths()),
  listRegisteredFileIdentities(accessToken),
  listParentIds(accessToken),
]);
const families = buildFamilies(storagePaths, registeredFileIdentities, parentIds);
const missingFileCount = families.reduce(
  (total, family) => total + family.missingFiles.length,
  0,
);

if (APPLY) {
  const writes = families.flatMap((family) => {
    const familyWrites = family.hasParent
      ? []
      : [
          {
            update: {
              name: `projects/${PROJECT_ID}/databases/(default)/documents/fonts/${family.fontId}`,
              fields: encodeFields(parentDocument(family)),
            },
            updateTransforms: [
              { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" },
            ],
          },
        ];

    return [
      ...familyWrites,
      ...family.missingFiles.map((file) => ({
        update: {
          name: `projects/${PROJECT_ID}/databases/(default)/documents/fonts/${family.fontId}/files/${file.id}`,
          fields: encodeFields({
            ...file,
            enabled: true,
            fontId: family.fontId,
            kind: "font",
          }),
        },
        updateTransforms: [
          { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" },
        ],
      })),
    ];
  });

  await commitWrites(writes, accessToken);
}

console.log(
  JSON.stringify(
    {
      applied: APPLY,
      familiesWithMissingFiles: families.length,
      missingFileCount,
      createdFamilies: families.filter((family) => !family.hasParent).map(
        (family) => family.sourceFolder,
      ),
      repairedFamilies: families.map((family) => ({
        files: family.missingFiles.length,
        sourceFolder: family.sourceFolder,
      })),
    },
    null,
    2,
  ),
);
