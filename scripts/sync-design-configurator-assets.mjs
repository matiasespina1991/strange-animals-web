/* eslint-disable no-await-in-loop -- Upload and Firestore batches stay bounded and ordered. */
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const PROJECT_ID = "strange-animals-web";
const BUCKET = "strange-animals-web.firebasestorage.app";
const COLLECTION = "images";
const STORAGE_ROOT = "media/public/design-configurator-assets";
const FIRESTORE_DOCUMENT_ROOT = `projects/${PROJECT_ID}/databases/(default)/documents`;
const FIRESTORE_API_ROOT = `https://firestore.googleapis.com/v1/${FIRESTORE_DOCUMENT_ROOT}`;
const STORAGE_API_ROOT = `https://storage.googleapis.com/storage/v1/b/${BUCKET}`;
const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "..");
const INPUT_ROOT = path.join(REPOSITORY_ROOT, "input");
const MODE = process.argv.includes("--upload")
  ? "upload"
  : process.argv.includes("--dry-run")
    ? "dry-run"
    : undefined;
const GROUPS = [
  {
    key: "hvnter",
    label: "Hvnter assets",
    folder: "by Hvnter",
    storageFolder: "hvnter",
  },
  {
    key: "bitmancer",
    label: "Bitmancer Y2K Assets",
    folder: "by Bitmancer",
    storageFolder: "bitmancer",
  },
];
const STORAGE_CONCURRENCY = 8;
const FIRESTORE_BATCH_SIZE = 400;

function slugify(value) {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "asset"
  );
}

async function walkSvgFiles(directory) {
  const result = [];
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await walkSvgFiles(filePath)));
    else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".svg")
      result.push(filePath);
  }

  return result;
}

function removeTechnicalFolders(parts) {
  return parts.filter((part) => part.toLowerCase() !== "svg");
}

function prepareSvg(source, sourcePath) {
  if (/<\s*(?:script|foreignObject)\b/i.test(source)) {
    throw new Error(`Active SVG markup is not allowed: ${sourcePath}`);
  }
  if (/\son[a-z]+\s*=/i.test(source)) {
    throw new Error(`SVG event attributes are not allowed: ${sourcePath}`);
  }
  const hrefAttributes = source.matchAll(
    /\b(?:xlink:)?href\s*=\s*(["'])(.*?)\1/gi,
  );
  for (const [, , value] of hrefAttributes) {
    if (
      value &&
      !value.startsWith("#") &&
      !/^data:image\/(?:png|jpeg|webp);base64,/i.test(value)
    ) {
      throw new Error(`External SVG references are not allowed: ${sourcePath}`);
    }
  }
  if (
    /@import\b|url\(\s*["']?(?!#|data:image\/(?:png|jpeg|webp);base64,)/i.test(
      source,
    )
  ) {
    throw new Error(`External SVG URL references are not allowed: ${sourcePath}`);
  }

  const cleaned = source
    .replace(/<\?xml[\s\S]*?\?>\s*/i, "")
    .replace(/<!DOCTYPE[\s\S]*?>\s*/i, "");
  if (!/<svg\b/i.test(cleaned)) {
    throw new Error(`Missing SVG root element: ${sourcePath}`);
  }
  return cleaned;
}

function getAspectRatio(svg) {
  const root = svg.match(/<svg\b([^>]*)>/i)?.[1] ?? "";
  const viewBox = root.match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1];
  if (viewBox) {
    const [, , width, height] = viewBox.trim().split(/[\s,]+/).map(Number);
    if (width > 0 && height > 0) return width / height;
  }

  const width = Number.parseFloat(
    root.match(/\bwidth\s*=\s*["']([\d.]+)/i)?.[1] ?? "",
  );
  const height = Number.parseFloat(
    root.match(/\bheight\s*=\s*["']([\d.]+)/i)?.[1] ?? "",
  );
  return width > 0 && height > 0 ? width / height : 1;
}

async function getAssets() {
  const assets = [];
  for (const group of GROUPS) {
    const groupRoot = path.join(INPUT_ROOT, group.folder);
    const files = await walkSvgFiles(groupRoot);
    for (const filePath of files) {
      const relativePath = path.relative(groupRoot, filePath);
      const originalParts = relativePath.split(path.sep);
      const originalDirectoryParts = originalParts.slice(0, -1);
      const visibleDirectoryParts = removeTechnicalFolders(
        group.key === "bitmancer"
          ? originalDirectoryParts.slice(1)
          : originalDirectoryParts,
      );
      const sourcePath = path.posix.join(
        group.folder,
        relativePath.split(path.sep).join("/"),
      );
      const id = `asset-${createHash("sha256")
        .update(`${group.key}\0${relativePath.split(path.sep).join("/")}`)
        .digest("hex")
        .slice(0, 32)}`;
      const storageDirectory = [
        STORAGE_ROOT,
        group.storageFolder,
        ...visibleDirectoryParts.map(slugify),
      ]
        .filter(Boolean)
        .join("/");
      const storagePath = `${storageDirectory}/${id}.svg`;
      const fileName = path.basename(filePath);
      const displayName = path.basename(fileName, path.extname(fileName));
      const svg = prepareSvg(await readFile(filePath, "utf8"), sourcePath);
      const token = randomUUID();
      const downloadUrl =
        `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/` +
        `${encodeURIComponent(storagePath)}?alt=media&token=${token}`;

      assets.push({
        id,
        title: displayName,
        label: displayName,
        sourceFileName: fileName,
        sourcePath,
        assetType: "designConfigurator",
        assetGroup: group.key,
        assetGroupLabel: group.label,
        folderPath: visibleDirectoryParts.join("/"),
        storagePath,
        downloadUrl,
        contentType: "image/svg+xml",
        imageRatio: getAspectRatio(svg),
        enabled: true,
        version: 1,
        updatedAt: new Date().toISOString(),
        bytes: Buffer.from(svg),
        downloadToken: token,
      });
    }
  }
  return assets.sort(
    (left, right) =>
      left.assetGroup.localeCompare(right.assetGroup) ||
      left.folderPath.localeCompare(right.folderPath) ||
      left.sourceFileName.localeCompare(right.sourceFileName),
  );
}

function getAccessToken() {
  return execFileSync("gcloud", ["auth", "print-access-token"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

async function fetchJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
  }
  return response.status === 204 ? {} : response.json();
}

async function getExistingImageIds(token) {
  const ids = new Set();
  let pageToken;
  do {
    const url = new URL(`${FIRESTORE_API_ROOT}/${COLLECTION}`);
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const page = await fetchJson(url, token);
    for (const document of page.documents ?? [])
      ids.add(document.name.split("/").at(-1));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return ids;
}

async function ensureDestinationIsClear(token, assets) {
  const existingIds = await getExistingImageIds(token);
  const conflicts = assets.filter((asset) => existingIds.has(asset.id));
  if (conflicts.length) {
    throw new Error(
      `Firestore already contains ${conflicts.length} generated asset ids. Refusing to overwrite.`,
    );
  }

  const url = new URL(`${STORAGE_API_ROOT}/o`);
  url.searchParams.set("prefix", STORAGE_ROOT);
  url.searchParams.set("maxResults", "1");
  const objects = await fetchJson(url, token);
  if (objects.items?.length) {
    throw new Error(
      `Storage destination ${STORAGE_ROOT} is not empty. Refusing to overwrite existing objects.`,
    );
  }
}

async function uploadObject(asset, token) {
  const boundary = `svg-upload-${randomUUID()}`;
  const metadata = {
    name: asset.storagePath,
    contentType: asset.contentType,
    metadata: { firebaseStorageDownloadTokens: asset.downloadToken },
  };
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${asset.contentType}\r\n\r\n`,
    ),
    asset.bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const url = new URL(
    `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o`,
  );
  url.searchParams.set("uploadType", "multipart");
  url.searchParams.set("name", asset.storagePath);
  url.searchParams.set("ifGenerationMatch", "0");
  await fetchJson(url, token, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
}

function firestoreValue(value) {
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === "number") return { doubleValue: value };
  throw new TypeError(`Unsupported Firestore field value: ${String(value)}`);
}

function makeFirestoreWrite(asset) {
  const fields = Object.fromEntries(
    Object.entries(asset)
      .filter(([key]) => !["bytes", "downloadToken"].includes(key))
      .map(([key, value]) => [key, firestoreValue(value)]),
  );
  fields.updatedAt = { timestampValue: asset.updatedAt };
  return {
    update: {
      name: `${FIRESTORE_DOCUMENT_ROOT}/${COLLECTION}/${asset.id}`,
      fields,
    },
    currentDocument: { exists: false },
  };
}

async function writeFirestoreBatch(assets, token) {
  const url = `${FIRESTORE_API_ROOT}:batchWrite`;
  const committed = [];
  try {
    for (let index = 0; index < assets.length; index += FIRESTORE_BATCH_SIZE) {
      const batch = assets.slice(index, index + FIRESTORE_BATCH_SIZE);
      const writes = batch.map(makeFirestoreWrite);
      const result = await fetchJson(url, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ writes }),
      });
      const statuses = result.status ?? [];
      const failure = statuses.find((status) => status.code);
      committed.push(
        ...batch.filter((_, writeIndex) => !statuses[writeIndex]?.code),
      );
      if (failure) {
        throw new Error(`Firestore batch failed: ${JSON.stringify(failure)}`);
      }
    }
  } catch (error) {
    if (committed.length) {
      await deleteFirestoreDocuments(committed, token).catch((rollbackError) => {
        console.error("Could not fully roll back Firestore asset documents.", rollbackError);
      });
    }
    throw error;
  }
}

async function deleteUploadedObject(asset, token) {
  const url = new URL(`${STORAGE_API_ROOT}/o/${encodeURIComponent(asset.storagePath)}`);
  await fetchJson(url, token, { method: "DELETE" });
}

async function deleteFirestoreDocuments(assets, token) {
  const writes = assets.map((asset) => ({
    delete: `${FIRESTORE_DOCUMENT_ROOT}/${COLLECTION}/${asset.id}`,
  }));
  for (let index = 0; index < writes.length; index += FIRESTORE_BATCH_SIZE) {
    const result = await fetchJson(`${FIRESTORE_API_ROOT}:batchWrite`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ writes: writes.slice(index, index + FIRESTORE_BATCH_SIZE) }),
    });
    const failure = result.status?.find((status) => status.code);
    if (failure)
      throw new Error(`Firestore rollback failed: ${JSON.stringify(failure)}`);
  }
}

async function runPool(items, concurrency, worker) {
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++;
        await worker(items[index], index);
      }
    }),
  );
}

if (!MODE) {
  throw new Error("Choose --dry-run or --upload.");
}

const assets = await getAssets();
const groupCounts = Object.fromEntries(
  GROUPS.map((group) => [
    group.label,
    assets.filter((asset) => asset.assetGroup === group.key).length,
  ]),
);
console.log(`Prepared ${assets.length} sanitized SVG assets:`, groupCounts);
console.log(
  "Folders:",
  [...new Set(assets.map((asset) => `${asset.assetGroup}/${asset.folderPath}`))],
);

if (MODE === "dry-run") {
  console.log("Dry run only; no Firebase objects or documents were written.");
} else {
  const token = getAccessToken();
  await ensureDestinationIsClear(token, assets);
  const uploaded = [];
  let completed = 0;
  try {
    await runPool(assets, STORAGE_CONCURRENCY, async (asset) => {
      await uploadObject(asset, token);
      uploaded.push(asset);
      completed += 1;
      if (completed % 100 === 0 || completed === assets.length)
        console.log(`Uploaded ${completed}/${assets.length} SVGs.`);
    });
    await writeFirestoreBatch(assets, token);
    console.log(`Wrote ${assets.length} image documents to /${COLLECTION}.`);
  } catch (error) {
    console.error("Asset sync failed; removing objects uploaded by this run.");
    const cleanupFailures = [];
    await runPool(uploaded, STORAGE_CONCURRENCY, async (asset) => {
      try {
        await deleteUploadedObject(asset, token);
      } catch (cleanupError) {
        cleanupFailures.push({ asset: asset.id, error: cleanupError });
      }
    });
    if (cleanupFailures.length)
      console.error(`Could not remove ${cleanupFailures.length} uploaded SVG objects.`);
    throw error;
  }
}