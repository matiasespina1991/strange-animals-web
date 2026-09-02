/* eslint-disable no-await-in-loop -- Firestore commit batches are intentionally sequential. */
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readdir, stat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const PROJECT_ID = 'strange-animals-web';
const STORAGE_ROOT = 'media/private/fonts';
const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const SOURCE_ROOT_ARGUMENT = readOption('--source-root');
const LOCAL_ROOT = path.resolve(
  REPOSITORY_ROOT,
  SOURCE_ROOT_ARGUMENT ?? 'public/media/fonts',
);
const GCLOUD_CANDIDATE =
  '/Users/matiasespina/Downloads/google-cloud-sdk/bin/gcloud';
const GCLOUD = existsSync(GCLOUD_CANDIDATE) ? GCLOUD_CANDIDATE : 'gcloud';
const FONT_EXTENSIONS = new Set(['otf', 'ttf', 'woff', 'woff2']);
const WRITE_FIRESTORE_FILES_ONLY = process.argv.includes(
  '--write-firestore-files-only',
);
const WRITE_FIRESTORE =
  process.argv.includes('--write-firestore') || WRITE_FIRESTORE_FILES_ONLY;
const UPLOAD_STORAGE = process.argv.includes('--upload-storage');
const ENABLED = !process.argv.includes('--disabled');
const INCLUDED_SOURCE_FOLDERS = new Set(readOptions('--include-folder'));
const DISPLAY_NAME_OVERRIDES = {
  OnlineWebFonts_COM_116e18788ced48c5f4ea2dfcbfe9c7e1: 'kfontZ111W01-Regular',
  OnlineWebFonts_COM_8fe15e6d5697c6e91c295fd95175a8b4: 'BloorW00-Regular',
};

function readOption(name) {
  const optionIndex = process.argv.indexOf(name);

  if (optionIndex === -1) return undefined;

  const value = process.argv[optionIndex + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a path value`);
  }

  return value;
}

function readOptions(name) {
  return process.argv.flatMap((argument, index) => {
    if (argument !== name) return [];

    const value = process.argv[index + 1];

    if (!value || value.startsWith('--')) {
      throw new Error(`${name} requires a folder name`);
    }

    return [value];
  });
}

const relativeLocalRoot = path.relative(REPOSITORY_ROOT, LOCAL_ROOT);

if (
  relativeLocalRoot.startsWith(`..${path.sep}`) ||
  path.isAbsolute(relativeLocalRoot) ||
  !existsSync(LOCAL_ROOT)
) {
  throw new Error(
    `Source root must exist inside the repository: ${LOCAL_ROOT}`,
  );
}

function slugify(value) {
  return value
    .replaceAll(/[™®©]/g, '')
    .normalize('NFKD')
    .replaceAll(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replaceAll('&', ' and ')
    .replaceAll(/[^a-z\d]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');
}

function toDisplayName(value) {
  return value
    .replaceAll(/[-_]/g, ' ')
    .replace(/^\d{6,}\s+/, '')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function toStoragePath(...segments) {
  return segments.join('/').replaceAll(path.sep, '/');
}

function getExtension(fileName) {
  return path.extname(fileName).slice(1).toLowerCase();
}

function getContentType(extension) {
  return (
    {
      otf: 'font/otf',
      ttf: 'font/ttf',
      woff: 'font/woff',
      woff2: 'font/woff2',
      zip: 'application/zip',
      txt: 'text/plain',
      md: 'text/markdown',
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
    }[extension] ?? 'application/octet-stream'
  );
}

function getFileKind(extension, fileName) {
  const lowerName = fileName.toLowerCase();

  if (FONT_EXTENSIONS.has(extension)) return 'font';
  if (extension === 'zip') return 'archive';
  if (lowerName.includes('license') || lowerName.includes('licence')) {
    return 'license';
  }

  if (['md', 'pdf', 'txt'].includes(extension)) return 'documentation';
  if (['jpeg', 'jpg', 'png', 'webp'].includes(extension)) return 'image';

  return 'other';
}

function getFileId(relativePath) {
  const baseSlug = slugify(relativePath.replace(/\.[^/.]+$/, '')) || 'file';
  const hash = createHash('sha256')
    .update(relativePath)
    .digest('hex')
    .slice(0, 10);

  return `${baseSlug.slice(0, 80)}-${hash}`;
}

function previewScore(file) {
  const name = file.fileName.toLowerCase();
  const formatScore = {otf: 0, woff2: 1, woff: 2, ttf: 3}[file.extension] ?? 9;
  const regularBonus = /(^|[-_ ])(regular|normal)([-_. ]|$)/.test(name)
    ? -4
    : 0;
  const sourceBonus = name.startsWith('source.') ? -3 : 0;
  const variantPenalty =
    /(italic|outline|display|rough|thin|bold|condensed|wide)/.test(name)
      ? 3
      : 0;

  return formatScore + regularBonus + sourceBonus + variantPenalty;
}

async function walkFiles(directory, relativeRoot = '') {
  const entries = await readdir(directory, {withFileTypes: true});
  const files = [];

  for (const entry of entries) {
    if (entry.name === '.DS_Store') continue;

    const relativePath = path.join(relativeRoot, entry.name);
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkFiles(absolutePath, relativePath)));
      continue;
    }

    if (!entry.isFile()) continue;

    const fileStat = await stat(absolutePath);
    const normalizedRelativePath = relativePath.replaceAll(path.sep, '/');
    const extension = getExtension(entry.name);

    files.push({
      fileName: entry.name,
      relativePath: normalizedRelativePath,
      extension,
      contentType: getContentType(extension),
      kind: getFileKind(extension, entry.name),
      sizeBytes: fileStat.size,
    });
  }

  return files.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath, undefined, {
      sensitivity: 'base',
    }),
  );
}

async function buildCatalog() {
  const entries = await readdir(LOCAL_ROOT, {withFileTypes: true});
  const availableFolders = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const missingFolders = [...INCLUDED_SOURCE_FOLDERS].filter(
    (folder) => !availableFolders.includes(folder),
  );

  if (missingFolders.length > 0) {
    throw new Error(`Included folders not found: ${missingFolders.join(', ')}`);
  }

  const folders = availableFolders
    .filter(
      (folder) =>
        INCLUDED_SOURCE_FOLDERS.size === 0 ||
        INCLUDED_SOURCE_FOLDERS.has(folder),
    )
    .sort((left, right) =>
      left.localeCompare(right, undefined, {sensitivity: 'base'}),
    );
  const ids = new Set();
  const catalog = [];

  for (const [index, sourceFolder] of folders.entries()) {
    const id = slugify(sourceFolder);
    const displayName =
      DISPLAY_NAME_OVERRIDES[sourceFolder] ?? toDisplayName(sourceFolder);

    if (!id || ids.has(id)) {
      throw new Error(`Invalid or duplicate font id: ${sourceFolder} -> ${id}`);
    }

    ids.add(id);

    const files = await walkFiles(path.join(LOCAL_ROOT, sourceFolder));
    const fontFiles = files.filter((file) => file.kind === 'font');
    const preview = [...fontFiles].sort(
      (left, right) =>
        previewScore(left) - previewScore(right) ||
        left.relativePath.localeCompare(right.relativePath),
    )[0];
    const storagePrefix = toStoragePath(STORAGE_ROOT, sourceFolder);

    catalog.push({
      id,
      document: {
        id,
        name: displayName,
        sortName: displayName.normalize('NFKD').toLocaleLowerCase(),
        sourceFolder,
        storagePrefix,
        enabled: ENABLED,
        kind: sourceFolder === 'VARIOUS' ? 'collection' : 'family',
        formats: [...new Set(fontFiles.map((file) => file.extension))].sort(),
        fileCount: files.length,
        variantCount: fontFiles.length,
        preview: preview
          ? {
              fileName: preview.fileName,
              format: preview.extension,
              storagePath: toStoragePath(storagePrefix, preview.relativePath),
            }
          : null,
        sortOrder: index,
        version: 1,
      },
      files: files.map((file) => ({
        id: getFileId(file.relativePath),
        document: {
          id: getFileId(file.relativePath),
          fontId: id,
          ...file,
          storagePath: toStoragePath(storagePrefix, file.relativePath),
          // A disabled family must remain inspectable in Development. Individual
          // files stay enabled; the parent document controls catalog visibility.
          enabled: true,
        },
      })),
    });
  }

  return catalog;
}

function runGcloud(arguments_, options = {}) {
  const result = spawnSync(GCLOUD, arguments_, {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(
      `gcloud failed with exit code ${result.status ?? 'unknown'}`,
    );
  }

  return options.capture ? result.stdout.trim() : '';
}

function uploadStorage(catalog) {
  for (const font of catalog) {
    runGcloud([
      'storage',
      'rsync',
      '--recursive',
      '--exclude',
      '(^|/)\\.DS_Store$',
      path.join(LOCAL_ROOT, font.document.sourceFolder),
      `gs://${PROJECT_ID}.firebasestorage.app/${font.document.storagePrefix}`,
    ]);
  }
}

function encodeFirestoreValue(value) {
  if (value === null) return {nullValue: null};
  if (typeof value === 'boolean') return {booleanValue: value};
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? {integerValue: String(value)}
      : {doubleValue: value};
  }

  if (typeof value === 'string') return {stringValue: value};
  if (Array.isArray(value)) {
    return {
      arrayValue: {values: value.map((item) => encodeFirestoreValue(item))},
    };
  }

  return {
    mapValue: {
      fields: Object.fromEntries(
        Object.entries(value).map(([key, nestedValue]) => [
          key,
          encodeFirestoreValue(nestedValue),
        ]),
      ),
    },
  };
}

function encodeFirestoreFields(data) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      encodeFirestoreValue(value),
    ]),
  );
}

async function writeFirestore(catalog) {
  const accessToken = runGcloud(['auth', 'print-access-token'], {
    capture: true,
  });
  const writes = [];

  for (const font of catalog) {
    if (!WRITE_FIRESTORE_FILES_ONLY) {
      writes.push({
        documentPath: `fonts/${font.id}`,
        data: font.document,
      });
    }

    for (const file of font.files) {
      writes.push({
        documentPath: `fonts/${font.id}/files/${file.id}`,
        data: file.document,
      });
    }
  }

  for (let index = 0; index < writes.length; index += 450) {
    const commitWrites = writes.slice(index, index + 450).map((write) => ({
      update: {
        name: `projects/${PROJECT_ID}/databases/(default)/documents/${write.documentPath}`,
        fields: encodeFirestoreFields(write.data),
      },
      updateMask: {fieldPaths: Object.keys(write.data)},
      updateTransforms: [
        {fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME'},
      ],
    }));
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({writes: commitWrites}),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Firestore commit failed (${response.status}): ${await response.text()}`,
      );
    }
  }
}

const catalog = await buildCatalog();
const fileCount = catalog.reduce((total, font) => total + font.files.length, 0);

if (UPLOAD_STORAGE) uploadStorage(catalog);
if (WRITE_FIRESTORE) await writeFirestore(catalog);

console.log(
  JSON.stringify(
    {
      projectId: PROJECT_ID,
      localSource: relativeLocalRoot,
      storageDestination: `${STORAGE_ROOT}/`,
      fontDocuments: catalog.length,
      fileDocuments: fileCount,
      storageUploaded: UPLOAD_STORAGE,
      firestoreWritten: WRITE_FIRESTORE,
      firestoreFilesOnly: WRITE_FIRESTORE_FILES_ONLY,
      enabled: ENABLED,
      sample: catalog.slice(0, 3).map((font) => font.document),
    },
    null,
    2,
  ),
);
