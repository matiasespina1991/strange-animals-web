import assert from 'node:assert/strict';

const projectId = 'strange-animals-web';
const bucket = `${projectId}.firebasestorage.app`;
const authBase = 'http://127.0.0.1:9099';
const documentRoot = `projects/${projectId}/databases/(default)/documents`;
const firestoreBase = `http://127.0.0.1:8080/v1/${documentRoot}`;
const storageBase = `http://127.0.0.1:9199/v0/b/${bucket}/o`;
const uuid = () => crypto.randomUUID();

async function request(url, {token, ...options} = {}) {
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(url, {...options, headers});
  return {response, body: await response.text()};
}

async function signUp(label) {
  const result = await request(
    `${authBase}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        email: `${label}-${uuid()}@example.test`,
        password: 'rules-test-password',
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
    token: 'owner',
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      writes: [{update: {name: `${documentRoot}/${path}`, fields}}],
    }),
  });
  assert.equal(result.response.status, 200, result.body);
}

async function seedObject(path, contentType, contents) {
  const result = await request(
    `${storageBase}?uploadType=media&name=${encodeURIComponent(path)}`,
    {
      token: 'owner',
      method: 'POST',
      headers: {'Content-Type': contentType},
      body: contents,
    },
  );
  assert.equal(result.response.status, 200, result.body);
}

const owner = await signUp('owner');
const other = await signUp('other');
const fontPath = 'fonts/rules-test-font';
const fontFilePath = `${fontPath}/files/regular`;
const fontStoragePath = 'media/private/fonts/rules-test/regular.woff2';

await seedDocument(fontPath, {
  name: {stringValue: 'Rules test font'},
  enabled: {booleanValue: false},
});
await seedDocument(fontFilePath, {
  kind: {stringValue: 'font'},
  fileName: {stringValue: 'regular.woff2'},
  relativePath: {stringValue: 'regular.woff2'},
  storagePath: {stringValue: fontStoragePath},
  extension: {stringValue: 'woff2'},
});
await seedObject(fontStoragePath, 'font/woff2', 'font fixture');

const fontReads = await Promise.all(
  [fontPath, fontFilePath].map(async (path) => ({
    path,
    readable: await request(`${firestoreBase}/${path}`, {
      token: owner.idToken,
    }),
    denied: await request(`${firestoreBase}/${path}`),
  })),
);
for (const {path, readable, denied} of fontReads) {
  assertStatus(readable, 200, `authenticated font read ${path}`);
  assert.ok(
    [401, 403].includes(denied.response.status),
    'unauthenticated font read must fail',
  );
}

const fontBytes = await request(
  `${storageBase}/${encodeURIComponent(fontStoragePath)}?alt=media`,
  {token: other.idToken},
);
assertStatus(fontBytes, 200, 'authenticated private font download');
const anonymousFontBytes = await request(
  `${storageBase}/${encodeURIComponent(fontStoragePath)}?alt=media`,
);
assert.ok(
  [401, 403].includes(anonymousFontBytes.response.status),
  'unauthenticated font download must fail',
);

const projectIdForTest = uuid();
const versionId = uuid();
const uid = owner.localId;
const assetRoot = `media/private/design-gallery/${uid}/${projectIdForTest}/${versionId}`;
const projectPath = `designUsers/${uid}/projects/${projectIdForTest}`;
const versionPath = `${projectPath}/versions/${versionId}`;
const commit = await request(`${firestoreBase}:commit`, {
  token: owner.idToken,
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    writes: [
      {
        update: {
          name: `${documentRoot}/${projectPath}`,
          fields: {
            title: {stringValue: 'Rules test'},
            latestVersion: {integerValue: '1'},
            latestVersionId: {stringValue: versionId},
            frontPreviewPath: {stringValue: `${assetRoot}/front.png`},
            backPreviewPath: {stringValue: `${assetRoot}/back.png`},
          },
        },
        updateTransforms: [
          {fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME'},
          {fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME'},
        ],
        currentDocument: {exists: false},
      },
      {
        update: {
          name: `${documentRoot}/${versionPath}`,
          fields: {
            version: {integerValue: '1'},
            designPath: {stringValue: `${assetRoot}/design.json`},
            frontPreviewPath: {stringValue: `${assetRoot}/front.png`},
            backPreviewPath: {stringValue: `${assetRoot}/back.png`},
            modelPath: {stringValue: `${assetRoot}/model.glb`},
            modelFileName: {stringValue: 'Rules-test-v1.glb'},
            modelSizeBytes: {integerValue: '20'},
          },
        },
        updateTransforms: [
          {fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME'},
        ],
        currentDocument: {exists: false},
      },
    ],
  }),
});
assertStatus(
  commit,
  200,
  'owner creates project and immutable version atomically',
);

assertStatus(
  await request(`${firestoreBase}/${projectPath}`, {token: owner.idToken}),
  200,
  'owner reads project',
);
assertStatus(
  await request(`${firestoreBase}/${versionPath}`, {token: owner.idToken}),
  200,
  'owner reads version',
);
const privateReads = await Promise.all(
  [projectPath, versionPath].map(async (path) => ({
    path,
    denied: await request(`${firestoreBase}/${path}`, {
      token: other.idToken,
    }),
  })),
);
for (const {path, denied} of privateReads) {
  assertStatus(denied, 403, `other account cannot read ${path}`);
}

const immutableVersion = await request(
  `${firestoreBase}/${versionPath}?updateMask.fieldPaths=version`,
  {
    token: owner.idToken,
    method: 'PATCH',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      fields: {
        version: {integerValue: '2'},
      },
    }),
  },
);
assertStatus(immutableVersion, 403, 'version documents are immutable');

const galleryObjectPath = `${assetRoot}/design.json`;
const galleryUpload = await request(
  `${storageBase}?uploadType=media&name=${encodeURIComponent(galleryObjectPath)}`,
  {
    token: owner.idToken,
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: '{}',
  },
);
assertStatus(galleryUpload, 200, 'owner uploads private gallery asset');
assertStatus(
  await request(
    `${storageBase}/${encodeURIComponent(galleryObjectPath)}?alt=media`,
    {token: owner.idToken},
  ),
  200,
  'owner reads private gallery asset',
);
const otherGalleryRead = await request(
  `${storageBase}/${encodeURIComponent(galleryObjectPath)}?alt=media`,
  {token: other.idToken},
);
assertStatus(
  otherGalleryRead,
  403,
  'other account cannot read private gallery asset',
);

console.log(
  'Firebase rules smoke tests passed: authenticated font reads, owner-only gallery, immutable versions.',
);
