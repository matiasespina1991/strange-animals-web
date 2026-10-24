import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import {
  deleteObject,
  getBlob,
  getStorage,
  ref,
  uploadBytes,
} from 'firebase/storage';
import {accountAuth} from './account-auth';
import {parseDesign, type LabelDesign} from './design-configurator-model';

const galleryDatabase = getFirestore(accountAuth.app);
const galleryStorage = getStorage(accountAuth.app);
const MAX_GALLERY_FILE_BYTES = 100 * 1024 * 1024;

export type GalleryProject = {
  id: string;
  title: string;
  latestVersion: number;
  latestVersionId: string;
  frontPreviewPath: string;
  backPreviewPath: string;
  updatedAt: Timestamp;
};

export type GalleryVersion = {
  id: string;
  version: number;
  createdAt: Timestamp;
  designPath: string;
  frontPreviewPath: string;
  backPreviewPath: string;
  modelPath: string;
  modelFileName: string;
  modelSizeBytes: number;
};

function projectCollection(uid: string) {
  return collection(galleryDatabase, 'designUsers', uid, 'projects');
}

function projectDocument(uid: string, projectId: string) {
  return doc(galleryDatabase, 'designUsers', uid, 'projects', projectId);
}

function versionCollection(uid: string, projectId: string) {
  return collection(
    galleryDatabase,
    'designUsers',
    uid,
    'projects',
    projectId,
    'versions',
  );
}

function versionDocument(uid: string, projectId: string, versionId: string) {
  return doc(
    galleryDatabase,
    'designUsers',
    uid,
    'projects',
    projectId,
    'versions',
    versionId,
  );
}

function readProject(
  id: string,
  data: Record<string, unknown>,
): GalleryProject {
  if (
    typeof data.title !== 'string' ||
    typeof data.latestVersion !== 'number' ||
    typeof data.latestVersionId !== 'string' ||
    typeof data.frontPreviewPath !== 'string' ||
    typeof data.backPreviewPath !== 'string' ||
    !data.updatedAt
  ) {
    throw new Error('This gallery project has invalid metadata.');
  }

  return {
    id,
    title: data.title,
    latestVersion: data.latestVersion,
    latestVersionId: data.latestVersionId,
    frontPreviewPath: data.frontPreviewPath,
    backPreviewPath: data.backPreviewPath,
    updatedAt: data.updatedAt as Timestamp,
  };
}

function readVersion(
  id: string,
  data: Record<string, unknown>,
): GalleryVersion {
  if (
    typeof data.version !== 'number' ||
    !data.createdAt ||
    typeof data.designPath !== 'string' ||
    typeof data.frontPreviewPath !== 'string' ||
    typeof data.backPreviewPath !== 'string' ||
    typeof data.modelPath !== 'string' ||
    typeof data.modelFileName !== 'string' ||
    typeof data.modelSizeBytes !== 'number'
  ) {
    throw new Error('This design version has invalid metadata.');
  }

  return {
    id,
    version: data.version,
    createdAt: data.createdAt as Timestamp,
    designPath: data.designPath,
    frontPreviewPath: data.frontPreviewPath,
    backPreviewPath: data.backPreviewPath,
    modelPath: data.modelPath,
    modelFileName: data.modelFileName,
    modelSizeBytes: data.modelSizeBytes,
  };
}

export async function listGalleryProjects(uid: string) {
  const snapshot = await getDocs(
    query(projectCollection(uid), orderBy('updatedAt', 'desc')),
  );
  return snapshot.docs.map((project) =>
    readProject(project.id, project.data()),
  );
}

export async function getGalleryProject(uid: string, projectId: string) {
  const snapshot = await getDoc(projectDocument(uid, projectId));
  return snapshot.exists() ? readProject(snapshot.id, snapshot.data()) : null;
}

export async function listGalleryVersions(uid: string, projectId: string) {
  const snapshot = await getDocs(
    query(versionCollection(uid, projectId), orderBy('version', 'desc')),
  );
  return snapshot.docs.map((version) =>
    readVersion(version.id, version.data()),
  );
}

export async function getGalleryVersion(
  uid: string,
  projectId: string,
  versionId: string,
) {
  const snapshot = await getDoc(versionDocument(uid, projectId, versionId));
  return snapshot.exists() ? readVersion(snapshot.id, snapshot.data()) : null;
}

export async function loadGalleryDesign(version: GalleryVersion) {
  const data = await getBlob(ref(galleryStorage, version.designPath));
  return parseDesign(JSON.parse(await data.text()));
}

export async function loadGalleryImage(path: string) {
  return getBlob(ref(galleryStorage, path));
}

export async function downloadGalleryModel(path: string) {
  return getBlob(ref(galleryStorage, path));
}

export async function saveGalleryVersion({
  uid,
  design,
  frontPreview,
  backPreview,
  model,
  projectId,
  asNewProject = false,
}: {
  uid: string;
  design: LabelDesign;
  frontPreview: Blob;
  backPreview: Blob;
  model: Blob;
  projectId?: string;
  asNewProject?: boolean;
}) {
  const existingProjectId = projectId && !asNewProject ? projectId : undefined;
  const targetProjectId = existingProjectId ?? crypto.randomUUID();
  const targetProjectReference = projectDocument(uid, targetProjectId);
  const existingSnapshot = existingProjectId
    ? await getDoc(targetProjectReference)
    : null;
  if (existingProjectId && !existingSnapshot?.exists()) {
    throw new Error('This project is no longer in your gallery.');
  }

  const previousVersion = existingSnapshot?.exists()
    ? readProject(existingSnapshot.id, existingSnapshot.data()).latestVersion
    : 0;
  const version = previousVersion + 1;
  const versionId = crypto.randomUUID();
  const root = `media/private/design-gallery/${uid}/${targetProjectId}/${versionId}`;
  const designPath = `${root}/design.json`;
  const frontPreviewPath = `${root}/front.png`;
  const backPreviewPath = `${root}/back.png`;
  const modelPath = `${root}/model.glb`;
  const safeTitle = (design.title.trim() || 'untitled-project')
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 136);
  const modelFileName = `${safeTitle || 'design'}-v${version}.glb`;
  const designFile = new Blob([JSON.stringify(design)], {
    type: 'application/json',
  });
  if (
    designFile.size > MAX_GALLERY_FILE_BYTES ||
    model.size === 0 ||
    model.size > MAX_GALLERY_FILE_BYTES
  ) {
    throw new Error(
      'The design or generated 3D model exceeds the 100 MB limit.',
    );
  }

  const files = [
    {path: designPath, file: designFile},
    {path: frontPreviewPath, file: frontPreview},
    {path: backPreviewPath, file: backPreview},
    {path: modelPath, file: model},
  ];

  try {
    await Promise.all(
      files.map(async ({path, file}) =>
        uploadBytes(ref(galleryStorage, path), file, {
          contentType: file.type,
        }),
      ),
    );

    const targetVersionReference = versionDocument(
      uid,
      targetProjectId,
      versionId,
    );
    await runTransaction(galleryDatabase, async (transaction) => {
      const [projectSnapshot, versionSnapshot] = await Promise.all([
        transaction.get(targetProjectReference),
        transaction.get(targetVersionReference),
      ]);
      if (versionSnapshot.exists()) {
        throw new Error('This version already exists. Please save again.');
      }

      if (existingProjectId) {
        if (
          !projectSnapshot.exists() ||
          readProject(projectSnapshot.id, projectSnapshot.data())
            .latestVersion !== previousVersion
        ) {
          throw new Error(
            'This project changed in another session. Reload it and retry.',
          );
        }

        transaction.update(targetProjectReference, {
          title: design.title,
          latestVersion: version,
          latestVersionId: versionId,
          frontPreviewPath,
          backPreviewPath,
          updatedAt: serverTimestamp(),
        });
      } else {
        if (projectSnapshot.exists()) {
          throw new Error(
            'Could not create a unique gallery project. Please retry.',
          );
        }

        transaction.set(targetProjectReference, {
          title: design.title,
          latestVersion: version,
          latestVersionId: versionId,
          frontPreviewPath,
          backPreviewPath,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      transaction.set(targetVersionReference, {
        version,
        designPath,
        frontPreviewPath,
        backPreviewPath,
        modelPath,
        modelFileName,
        modelSizeBytes: model.size,
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    await Promise.all(
      files.map(async ({path}) =>
        deleteObject(ref(galleryStorage, path)).catch(() => undefined),
      ),
    );
    if (error instanceof Error) throw error;
    throw new Error('The gallery save failed.', {cause: error});
  }

  const project = await getGalleryProject(uid, targetProjectId);
  if (!project)
    throw new Error('The saved gallery project could not be loaded.');
  return {project, versionId, version};
}
