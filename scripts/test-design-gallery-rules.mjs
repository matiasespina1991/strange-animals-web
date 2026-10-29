import assert from "node:assert/strict";

const projectId = "strange-animals-web";
const bucket = `${projectId}.firebasestorage.app`;
const authBase = "http://127.0.0.1:9099";
const documentRoot = `projects/${projectId}/databases/(default)/documents`;
const firestoreBase = `http://127.0.0.1:8080/v1/${documentRoot}`;
const storageBase = `http://127.0.0.1:9199/v0/b/${bucket}/o`;
const uuid = () => crypto.randomUUID();

async function request(url, { token, ...options } = {}) {
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // Firebase's upload endpoint treats application/json media bodies as
  // metadata. Use the same multipart protocol as uploadBytes so JSON fixtures
  // exercise Storage rules rather than hanging in the upload parser.
  if (url.startsWith(storageBase) && options.method === 'POST' && options.body !== undefined) {
    const target = new URL(url);
    const contentType = headers.get('Content-Type') ?? 'application/octet-stream';
    const boundary = 'rules-test-upload-boundary';
    const metadata = JSON.stringify({ name: target.searchParams.get('name'), contentType });
    options.body = `--${boundary}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n${options.body}\r\n--${boundary}--`;
    headers.set('Content-Type', `multipart/related; boundary=${boundary}`);
    headers.set('X-Goog-Upload-Protocol', 'multipart');
    target.searchParams.delete('uploadType');
    url = target.toString();
  }
  if (process.env.RULES_TRACE) console.log(options.method ?? 'GET', new URL(url).pathname);
  const response = await fetch(url, { ...options, headers, signal: AbortSignal.timeout(20000) });
  return { response, body: await response.text() };
}

async function signUp(label) {
  const result = await request(
    `${authBase}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `${label}-${uuid()}@example.test`,
        password: "rules-test-password",
        returnSecureToken: true,
      }),
    },
  );
  assert.equal(result.response.status, 200, result.body);
  return JSON.parse(result.body);
}

function assertStatus(result, expected, label) {
  assert.equal(result.response.status, expected, `${label}: ${result.body}`);
}

async function seedDocument(path, fields) {
  const result = await request(`${firestoreBase}:commit`, {
    token: "owner",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      writes: [{ update: { name: `${documentRoot}/${path}`, fields } }],
    }),
  });
  assert.equal(result.response.status, 200, result.body);
}

async function seedObject(path, contentType, contents) {
  const result = await request(
    `${storageBase}?uploadType=media&name=${encodeURIComponent(path)}`,
    {
      token: "owner",
      method: "POST",
      headers: { "Content-Type": contentType },
      body: contents,
    },
  );
  assert.equal(result.response.status, 200, result.body);
}

const owner = await signUp("owner");
const other = await signUp("other");
const fontPath = "fonts/rules-test-font";
const fontFilePath = `${fontPath}/files/regular`;
const fontStoragePath = "media/private/fonts/rules-test/regular.woff2";

await seedDocument(fontPath, {
  name: { stringValue: "Rules test font" },
  enabled: { booleanValue: false },
});
await seedDocument(fontFilePath, {
  kind: { stringValue: "font" },
  fileName: { stringValue: "regular.woff2" },
  relativePath: { stringValue: "regular.woff2" },
  storagePath: { stringValue: fontStoragePath },
  extension: { stringValue: "woff2" },
});
await seedObject(fontStoragePath, "font/woff2", "font fixture");

const fontReads = await Promise.all(
  [fontPath, fontFilePath].map(async (path) => ({
    path,
    readable: await request(`${firestoreBase}/${path}`, {
      token: owner.idToken,
    }),
    denied: await request(`${firestoreBase}/${path}`),
  })),
);
for (const { path, readable, denied } of fontReads) {
  assertStatus(readable, 200, `authenticated font read ${path}`);
  assert.ok(
    [401, 403].includes(denied.response.status),
    "unauthenticated font read must fail",
  );
}

const fontBytes = await request(
  `${storageBase}/${encodeURIComponent(fontStoragePath)}?alt=media`,
  { token: other.idToken },
);
assertStatus(fontBytes, 200, "authenticated private font download");
const anonymousFontBytes = await request(
  `${storageBase}/${encodeURIComponent(fontStoragePath)}?alt=media`,
);
assert.ok(
  [401, 403].includes(anonymousFontBytes.response.status),
  "unauthenticated font download must fail",
);

const projectIdForTest = uuid();
const versionId = uuid();
const uid = owner.localId;
const assetRoot = `media/private/design-gallery/${uid}/${projectIdForTest}/${versionId}`;
const projectPath = `designUsers/${uid}/projects/${projectIdForTest}`;
const versionPath = `${projectPath}/versions/${versionId}`;
const commit = await request(`${firestoreBase}:commit`, {
  token: owner.idToken,
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    writes: [
      {
        update: {
          name: `${documentRoot}/${projectPath}`,
          fields: {
            title: { stringValue: "Rules test" },
            latestVersion: { integerValue: "1" },
            latestVersionId: { stringValue: versionId },
            frontPreviewPath: { stringValue: `${assetRoot}/front.png` },
            backPreviewPath: { stringValue: `${assetRoot}/back.png` },
            frontSleevePreviewPath: {
              stringValue: `${assetRoot}/front-with-sleeve.png`,
            },
            backSleevePreviewPath: {
              stringValue: `${assetRoot}/back-with-sleeve.png`,
            },
          },
        },
        updateTransforms: [
          { fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" },
          { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" },
        ],
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${documentRoot}/${versionPath}`,
          fields: {
            version: { integerValue: "1" },
            designPath: { stringValue: `${assetRoot}/design.json` },
            frontPreviewPath: { stringValue: `${assetRoot}/front.png` },
            backPreviewPath: { stringValue: `${assetRoot}/back.png` },
            frontSleevePreviewPath: { stringValue: `${assetRoot}/front-with-sleeve.png` },
            backSleevePreviewPath: { stringValue: `${assetRoot}/back-with-sleeve.png` },
          },
        },
        updateTransforms: [
          { fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" },
        ],
        currentDocument: { exists: false },
      },
    ],
  }),
});
assertStatus(
  commit,
  200,
  "owner creates project and immutable version atomically",
);

assertStatus(
  await request(`${firestoreBase}/${projectPath}`, { token: owner.idToken }),
  200,
  "owner reads project",
);
assertStatus(
  await request(`${firestoreBase}/${versionPath}`, { token: owner.idToken }),
  200,
  "owner reads version",
);
const privateReads = await Promise.all(
  [projectPath, versionPath].map(async (path) => ({
    path,
    denied: await request(`${firestoreBase}/${path}`, {
      token: other.idToken,
    }),
  })),
);
for (const { path, denied } of privateReads) {
  assertStatus(denied, 403, `other account cannot read ${path}`);
}

const immutableVersion = await request(
  `${firestoreBase}/${versionPath}?updateMask.fieldPaths=version`,
  {
    token: owner.idToken,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        version: { integerValue: "2" },
      },
    }),
  },
);
assertStatus(immutableVersion, 403, "version documents are immutable");

const secondVersionId = uuid();
const secondRoot = `media/private/design-gallery/${uid}/${projectIdForTest}/${secondVersionId}`;
const secondPaths = Object.fromEntries([
  ['frontPreviewPath', 'front.png'], ['backPreviewPath', 'back.png'],
  ['frontSleevePreviewPath', 'front-with-sleeve.png'], ['backSleevePreviewPath', 'back-with-sleeve.png'],
].map(([key, file]) => [key, { stringValue: `${secondRoot}/${file}` }]));
const secondWrites = [
  {
    update: { name: `${documentRoot}/${projectPath}`, fields: {
      title: { stringValue: 'Rules test version 2' }, latestVersion: { integerValue: '2' },
      latestVersionId: { stringValue: secondVersionId }, ...secondPaths,
    } },
    updateMask: { fieldPaths: ['title', 'latestVersion', 'latestVersionId', ...Object.keys(secondPaths)] },
    updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
  },
  {
    update: { name: `${documentRoot}/${projectPath}/versions/${secondVersionId}`, fields: {
      version: { integerValue: '2' }, designPath: { stringValue: `${secondRoot}/design.json` }, ...secondPaths,
    } },
    updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
    currentDocument: { exists: false },
  },
];
const commitSecondVersion = token => request(`${firestoreBase}:commit`, {
  token, method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ writes: secondWrites }),
});
assertStatus(await commitSecondVersion(other.idToken), 403, 'other account cannot add a version');
assertStatus(await commitSecondVersion(owner.idToken), 200, 'owner saves version 2 including sleeve previews');
assert.ok([403, 409].includes((await commitSecondVersion(owner.idToken)).response.status), 'version replay is rejected by rules or create precondition');

const galleryObjectPath = `${assetRoot}/design.json`;
const galleryUpload = await request(
  `${storageBase}?uploadType=media&name=${encodeURIComponent(galleryObjectPath)}`,
  {
    token: owner.idToken,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  },
);
assertStatus(galleryUpload, 200, "owner uploads private gallery asset");
assertStatus(
  await request(
    `${storageBase}/${encodeURIComponent(galleryObjectPath)}?alt=media`,
    { token: owner.idToken },
  ),
  200,
  "owner reads private gallery asset",
);
const otherGalleryRead = await request(
  `${storageBase}/${encodeURIComponent(galleryObjectPath)}?alt=media`,
  { token: other.idToken },
);
assertStatus(
  otherGalleryRead,
  403,
  "other account cannot read private gallery asset",
);

const sleeveImageUploads = await Promise.all(
  ['front-with-sleeve.png', 'back-with-sleeve.png'].map(async (fileName) => {
    const imagePath = `${assetRoot}/${fileName}`;
    const imageUpload = await request(
      `${storageBase}?uploadType=media&name=${encodeURIComponent(imagePath)}`,
      {
        token: owner.idToken,
        method: 'POST',
        headers: { 'Content-Type': 'image/png' },
        body: new Uint8Array([137, 80, 78, 71]),
      },
    );
    return { fileName, imageUpload };
  }),
);
for (const { fileName, imageUpload } of sleeveImageUploads) {
  assertStatus(imageUpload, 200, `owner uploads ${fileName}`);
}

const sharedModelId = uuid();
await seedDocument(`sharedModels/${sharedModelId}`, {
  schemaVersion: { integerValue: "1" },
  visibility: { stringValue: "public" },
  ownerUid: { stringValue: owner.localId },
  title: { stringValue: "Rules test shared model" },
  fileName: { stringValue: "rules-test.glb" },
  storagePath: {
    stringValue: `media/public/shared-models/${owner.localId}/${sharedModelId}/rules-test.glb`,
  },
  contentType: { stringValue: "model/gltf-binary" },
  sizeBytes: { integerValue: "20" },
  createdAt: { timestampValue: new Date().toISOString() },
});

async function listOwnedModels(token, uid) {
  return request(`${firestoreBase}:runQuery`, {
    token,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "sharedModels" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "ownerUid" },
            op: "EQUAL",
            value: { stringValue: uid },
          },
        },
      },
    }),
  });
}

const ownerModels = await listOwnedModels(owner.idToken, owner.localId);
assertStatus(ownerModels, 200, "owner lists their public model shares");
assert.ok(ownerModels.body.includes(sharedModelId));
const otherModels = await listOwnedModels(other.idToken, other.localId);
assertStatus(otherModels, 200, "other account lists only their model shares");
assert.ok(!otherModels.body.includes(sharedModelId));

async function patchShared(token, fields, mask = Object.keys(fields)) {
  const query = mask.map(field => `updateMask.fieldPaths=${field}`).join('&');
  return request(`${firestoreBase}/sharedModels/${sharedModelId}?${query}`, {
    token, method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
}
assertStatus(await patchShared(owner.idToken, {
  title: { stringValue: 'Replacement model' }, sizeBytes: { integerValue: '25' },
}), 200, 'owner replaces version model metadata');
assertStatus(await patchShared(other.idToken, { title: { stringValue: 'Hijacked' } }), 403, 'another user cannot replace model');
assertStatus(await patchShared(undefined, { title: { stringValue: 'Anonymous' } }), 403, 'anonymous cannot replace model');
for (const [name, fields, mask] of [
  ['owner change', { ownerUid: { stringValue: other.localId } }],
  ['creation date change', { createdAt: { timestampValue: new Date().toISOString() } }],
  ['invalid title', { title: { stringValue: 'x'.repeat(121) } }],
  ['invalid size', { sizeBytes: { integerValue: '-1' } }],
  ['wrong size type', { sizeBytes: { stringValue: '25' } }],
  ['schema pollution', { extra: { booleanValue: true } }],
  ['remove required field', {}, ['title']],
  ['path change', { storagePath: { stringValue: 'media/public/shared-models/other/file.glb' } }],
]) assertStatus(await patchShared(owner.idToken, fields, mask), 403, name);
assertStatus(await request(`${firestoreBase}/sharedModels/${uuid()}`), 404, 'missing model can be checked before first upload');
assertStatus(await request(`${firestoreBase}/sharedModels/${sharedModelId}`, { token: owner.idToken, method: 'DELETE' }), 403, 'model record cannot be deleted');
const publicModelPath = `media/public/shared-models/${owner.localId}/${sharedModelId}/rules-test.glb`;
const uploadPublicModel = (token, type = 'model/gltf-binary', body = 'replacement binary') => request(`${storageBase}?uploadType=media&name=${encodeURIComponent(publicModelPath)}`, {
  token, method: 'POST', headers: { 'Content-Type': type }, body,
});
assertStatus(await uploadPublicModel(owner.idToken), 200, 'owner creates public GLB');
assertStatus(await uploadPublicModel(owner.idToken), 200, 'owner replaces same public GLB path');
assertStatus(await uploadPublicModel(other.idToken), 403, 'other user cannot overwrite GLB');
assertStatus(await uploadPublicModel(undefined), 403, 'anonymous cannot overwrite GLB');
assertStatus(await uploadPublicModel(owner.idToken, 'text/plain'), 403, 'replacement must remain a GLB');
assertStatus(await uploadPublicModel(owner.idToken, 'model/gltf-binary', ''), 403, 'replacement cannot be empty');

const renameProject = (token, title, extra = {}) => request(`${firestoreBase}:commit`, {
  token, method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ writes: [{
    update: { name: `${documentRoot}/${projectPath}`, fields: { title: { stringValue: title }, ...extra } },
    updateMask: { fieldPaths: ['title', ...Object.keys(extra)] },
    updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
  }] }),
});
assertStatus(await renameProject(owner.idToken, 'Renamed project'), 403, 'rename must use the authorized backend');
assertStatus(await renameProject(other.idToken, 'Hijacked'), 403, 'other user cannot rename');
assertStatus(await renameProject(undefined, 'Anonymous'), 403, 'anonymous cannot rename');
assertStatus(await renameProject(owner.idToken, ''), 403, 'empty name rejected');
assertStatus(await renameProject(owner.idToken, 'a'.repeat(121)), 403, 'oversize name rejected');
assertStatus(await renameProject(owner.idToken, 'Corrupt', { latestVersionId: { stringValue: uuid() } }), 403, 'rename cannot change version identity');
assertStatus(await renameProject(owner.idToken, 'Corrupt', { extraField: { stringValue: 'bad' } }), 403, 'rename cannot pollute schema');
for (const path of [projectPath, versionPath]) {
  assertStatus(await request(`${firestoreBase}/${path}`, { token: other.idToken, method: 'DELETE' }), 403, 'other user cannot delete project or version');
  assertStatus(await request(`${firestoreBase}/${path}`, { method: 'DELETE' }), 403, 'anonymous cannot delete project or version');
}
assertStatus(await request(`${firestoreBase}:commit`, {
  token: owner.idToken, method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ writes: [versionPath, `${projectPath}/versions/${secondVersionId}`, projectPath]
    .map(path => ({ delete: `${documentRoot}/${path}` })) }),
}), 403, 'owner cannot bypass the durable deletion workflow');

const lockedProjectId = uuid();
const lockedPath = `designUsers/${owner.localId}/projects/${lockedProjectId}`;
await seedDocument(lockedPath, {
  status: {stringValue: 'deleting'}, title: {stringValue: 'Locked'}, latestVersionId: {stringValue: uuid()},
});
assertStatus(await request(`${firestoreBase}/${lockedPath}`, {token: owner.idToken, method: 'DELETE'}), 403, 'owner cannot remove deletion lock');
assertStatus(await request(`${storageBase}?uploadType=media&name=${encodeURIComponent(`media/private/design-gallery/${owner.localId}/${lockedProjectId}/${uuid()}/front.png`)}`, {
  token: owner.idToken, method: 'POST', headers: {'Content-Type': 'image/png'}, body: 'late',
}), 403, 'new uploads blocked while deleting');
await seedDocument('designDeletionJobs/private-test', {ownerUid: {stringValue: owner.localId}, status: {stringValue: 'pending'}});
assertStatus(await request(`${firestoreBase}/designDeletionJobs/private-test`, {token: owner.idToken}), 200, 'owner can inspect own job');
assertStatus(await request(`${firestoreBase}/designDeletionJobs/private-test`, {token: other.idToken}), 403, 'other user cannot inspect job');
assertStatus(await request(`${firestoreBase}/designDeletionJobs/private-test`, {token: owner.idToken, method: 'DELETE'}), 403, 'owner cannot remove job');

console.log(
  "Firebase rules smoke tests passed: authenticated font reads, owner-only gallery, immutable versions.",
);
