import { settleUploads } from "./settle-uploads";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  runTransaction,
  onSnapshot,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import {
  deleteObject,
  getBlob,
  getStorage,
  ref,
  uploadBytes,
} from "firebase/storage";
import { accountAuth } from "./account-auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { parseDesign, type LabelDesign } from "./design-configurator-model";

const galleryDatabase = getFirestore(accountAuth.app);
const galleryStorage = getStorage(accountAuth.app);
const galleryFunctions = getFunctions(accountAuth.app, "europe-west3");
const MAX_GALLERY_FILE_BYTES = 100 * 1024 * 1024;

export type GalleryProject = {
  id: string;
  title: string;
  latestVersion: number;
  latestVersionId: string;
  frontPreviewPath: string;
  backPreviewPath: string;
  frontSleevePreviewPath?: string;
  backSleevePreviewPath?: string;
  createdAt?: Timestamp;
  updatedAt: Timestamp;
};

export type GalleryVersion = {
  id: string;
  version: number;
  createdAt: Timestamp;
  designPath: string;
  frontPreviewPath: string;
  backPreviewPath: string;
  frontSleevePreviewPath?: string;
  backSleevePreviewPath?: string;
  modelPath?: string;
  modelFileName?: string;
  modelSizeBytes?: number;
};

function projectCollection(uid: string) {
  return collection(galleryDatabase, "designUsers", uid, "projects");
}

function projectDocument(uid: string, projectId: string) {
  return doc(galleryDatabase, "designUsers", uid, "projects", projectId);
}

function versionCollection(uid: string, projectId: string) {
  return collection(
    galleryDatabase,
    "designUsers",
    uid,
    "projects",
    projectId,
    "versions",
  );
}

function versionDocument(uid: string, projectId: string, versionId: string) {
  return doc(
    galleryDatabase,
    "designUsers",
    uid,
    "projects",
    projectId,
    "versions",
    versionId,
  );
}

function readProject(
  id: string,
  data: Record<string, unknown>,
): GalleryProject {
  if (
    typeof data.title !== "string" ||
    typeof data.latestVersion !== "number" ||
    typeof data.latestVersionId !== "string" ||
    typeof data.frontPreviewPath !== "string" ||
    typeof data.backPreviewPath !== "string" ||
    (data.frontSleevePreviewPath !== undefined &&
      typeof data.frontSleevePreviewPath !== "string") ||
    (data.backSleevePreviewPath !== undefined &&
      typeof data.backSleevePreviewPath !== "string") ||
    !data.updatedAt
  ) {
    throw new Error("This gallery project has invalid metadata.");
  }

  return {
    id,
    title: data.title,
    latestVersion: data.latestVersion,
    latestVersionId: data.latestVersionId,
    frontPreviewPath: data.frontPreviewPath,
    backPreviewPath: data.backPreviewPath,
    frontSleevePreviewPath: data.frontSleevePreviewPath as string | undefined,
    backSleevePreviewPath: data.backSleevePreviewPath as string | undefined,
    createdAt: data.createdAt as Timestamp | undefined,
    updatedAt: data.updatedAt as Timestamp,
  };
}

function readVersion(
  id: string,
  data: Record<string, unknown>,
): GalleryVersion {
  if (
    typeof data.version !== "number" ||
    !data.createdAt ||
    typeof data.designPath !== "string" ||
    typeof data.frontPreviewPath !== "string" ||
    typeof data.backPreviewPath !== "string" ||
    (data.frontSleevePreviewPath !== undefined &&
      typeof data.frontSleevePreviewPath !== "string") ||
    (data.backSleevePreviewPath !== undefined &&
      typeof data.backSleevePreviewPath !== "string") ||
    (data.modelPath !== undefined && typeof data.modelPath !== "string") ||
    (data.modelFileName !== undefined &&
      typeof data.modelFileName !== "string") ||
    (data.modelSizeBytes !== undefined &&
      typeof data.modelSizeBytes !== "number") ||
    ([data.modelPath, data.modelFileName, data.modelSizeBytes].some(
      (value) => value !== undefined,
    ) &&
      [data.modelPath, data.modelFileName, data.modelSizeBytes].some(
        (value) => value === undefined,
      ))
  ) {
    throw new Error("This design version has invalid metadata.");
  }

  return {
    id,
    version: data.version,
    createdAt: data.createdAt as Timestamp,
    designPath: data.designPath,
    frontPreviewPath: data.frontPreviewPath,
    backPreviewPath: data.backPreviewPath,
    frontSleevePreviewPath: data.frontSleevePreviewPath as string | undefined,
    backSleevePreviewPath: data.backSleevePreviewPath as string | undefined,
    modelPath: data.modelPath as string | undefined,
    modelFileName: data.modelFileName as string | undefined,
    modelSizeBytes: data.modelSizeBytes as number | undefined,
  };
}

export async function listGalleryProjects(uid: string) {
  const snapshot = await getDocs(
    query(projectCollection(uid), orderBy("updatedAt", "desc")),
  );
  return snapshot.docs.filter(project => !project.data().status).map((project) =>
    readProject(project.id, project.data()),
  );
}

export async function getGalleryProject(uid: string, projectId: string) {
  const snapshot = await getDoc(projectDocument(uid, projectId));
  return snapshot.exists() && !snapshot.data().status ? readProject(snapshot.id, snapshot.data()) : null;
}

export async function renameGalleryProject(uid: string, projectId: string, rawTitle: string, expectedTitle: string) {
  if (accountAuth.currentUser?.uid !== uid) throw Error("Sign in to edit your project.");
  const title = rawTitle.trim();
  if (!title || title.length > 120) throw Error("Use a project name between 1 and 120 characters.");
  const result = await httpsCallable<{projectId: string; title: string; expectedTitle: string}, {title: string}>(galleryFunctions, "renameDesignProject")({projectId, title, expectedTitle});
  return result.data.title;
}

export async function deleteGalleryProject(uid: string, projectId: string, expectedVersionId: string) {
  if (accountAuth.currentUser?.uid !== uid) throw Error("Sign in to delete your project.");
  return (await httpsCallable<{projectId: string; expectedVersionId: string}, {status: string}>(galleryFunctions, "requestProjectDeletion")({projectId, expectedVersionId})).data;
}

export type GalleryDeletion = {id: string; title: string; latestVersionId: string; error?: string};
export function watchGalleryDeletions(uid: string, next: (jobs: GalleryDeletion[]) => void, error: (error: Error) => void) {
  return onSnapshot(projectCollection(uid), snapshot => next(snapshot.docs
    .filter(project => project.data().status === "deleting")
    .map(project => ({id: project.id, title: String(project.data().title), latestVersionId: String(project.data().latestVersionId),
      error: typeof project.data().deletionError === "string" ? project.data().deletionError : undefined}))), error);
}

export async function listGalleryVersions(uid: string, projectId: string) {
  const snapshot = await getDocs(
    query(versionCollection(uid, projectId), orderBy("version", "desc")),
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
  frontSleevePreview,
  backSleevePreview,
  projectId,
  asNewProject = false,
  asNewVersion = false,
  currentVersionId,
  expectedDesignPath,
  expectedProjectTitle,
}: {
  uid: string;
  design: LabelDesign;
  frontPreview: Blob;
  backPreview: Blob;
  frontSleevePreview: Blob;
  backSleevePreview: Blob;
  projectId?: string;
  asNewProject?: boolean;
  asNewVersion?: boolean;
  currentVersionId?: string;
  expectedDesignPath?: string;
  expectedProjectTitle?: string;
}) {
  const existingProjectId = projectId && !asNewProject ? projectId : undefined;
  const targetProjectId = existingProjectId ?? crypto.randomUUID();
  const targetProjectReference = projectDocument(uid, targetProjectId);
  const existingSnapshot = existingProjectId
    ? await getDoc(targetProjectReference)
    : null;
  if (existingProjectId && !existingSnapshot?.exists()) {
    throw new Error("This project is no longer in your gallery.");
  }
  if (existingSnapshot?.exists() && existingSnapshot.data().status) throw Error("This project is being deleted.");
  if (existingSnapshot?.exists() && expectedProjectTitle !== undefined && existingSnapshot.data().title !== expectedProjectTitle) {
    throw Error("The project name changed in another session. Reload before saving.");
  }

  const previousVersion = existingSnapshot?.exists()
    ? readProject(existingSnapshot.id, existingSnapshot.data()).latestVersion
    : 0;
  if (existingProjectId && !asNewVersion && !currentVersionId) {
    throw Error("Open a version before saving this project.");
  }
  const overwrite = Boolean(existingProjectId && currentVersionId && !asNewVersion);
  const versionId = overwrite ? currentVersionId! : crypto.randomUUID();
  const originalVersion = overwrite
    ? await getDoc(versionDocument(uid, targetProjectId, versionId)) : null;
  if (overwrite && !originalVersion?.exists()) throw Error("This version no longer exists.");
  if (overwrite && expectedDesignPath && originalVersion!.data()!.designPath !== expectedDesignPath) {
    throw Error("This version changed in another session. Reload before saving.");
  }
  const version = overwrite ? originalVersion!.data()!.version as number : previousVersion + 1;
  // Stage a fresh immutable snapshot; never overwrite the currently referenced
  // objects before all uploads succeed and the backend commits the pointer swap.
  const uploadId = overwrite ? crypto.randomUUID() : versionId;
  const root = `media/private/design-gallery/${uid}/${targetProjectId}/${uploadId}`;
  const designPath = `${root}/design.json`;
  const frontPreviewPath = `${root}/front.png`;
  const backPreviewPath = `${root}/back.png`;
  const frontSleevePreviewPath = `${root}/front-with-sleeve.png`;
  const backSleevePreviewPath = `${root}/back-with-sleeve.png`;
  const designFile = new Blob([JSON.stringify(design)], {
    type: "application/json",
  });
  if (designFile.size > MAX_GALLERY_FILE_BYTES) {
    throw new Error("The design exceeds the 100 MB limit.");
  }

  const files = [
    { path: designPath, file: designFile },
    { path: frontPreviewPath, file: frontPreview },
    { path: backPreviewPath, file: backPreview },
    { path: frontSleevePreviewPath, file: frontSleevePreview },
    { path: backSleevePreviewPath, file: backSleevePreview },
  ];

  try {
    if (import.meta.env.DEV) {
      console.info("[StudioShelf/repository] upload-start", {
        fileCount: files.length,
        totalBytes: files.reduce((total, entry) => total + entry.file.size, 0),
      });
    }
    await settleUploads(
      files.map(async ({ path, file }) =>
        uploadBytes(ref(galleryStorage, path), file, {
          contentType: file.type,
        }),
      ),
    );

    if (overwrite) {
      await httpsCallable(galleryFunctions, "saveDesignVersion")({
        projectId: targetProjectId, versionId, uploadId,
        expectedDesignPath: originalVersion!.data()!.designPath,
        expectedTitle: existingSnapshot!.data()!.title,
        title: design.title,
      });
    } else {
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
        throw new Error("This version already exists. Please save again.");
      }

      if (existingProjectId) {
        if (
          !projectSnapshot.exists() ||
          projectSnapshot.data().status ||
          projectSnapshot.data().title !== existingSnapshot?.data()?.title ||
          readProject(projectSnapshot.id, projectSnapshot.data())
            .latestVersion !== previousVersion
        ) {
          throw new Error(
            "This project changed in another session. Reload it and retry.",
          );
        }

        transaction.update(targetProjectReference, {
          title: design.title,
          latestVersion: version,
          latestVersionId: versionId,
          frontPreviewPath,
          backPreviewPath,
          frontSleevePreviewPath,
          backSleevePreviewPath,
          updatedAt: serverTimestamp(),
        });
      } else {
        if (projectSnapshot.exists()) {
          throw new Error(
            "Could not create a unique gallery project. Please retry.",
          );
        }

        transaction.set(targetProjectReference, {
          title: design.title,
          latestVersion: version,
          latestVersionId: versionId,
          frontPreviewPath,
          backPreviewPath,
          frontSleevePreviewPath,
          backSleevePreviewPath,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      transaction.set(targetVersionReference, {
        version,
        designPath,
        frontPreviewPath,
        backPreviewPath,
        frontSleevePreviewPath,
        backSleevePreviewPath,
        createdAt: serverTimestamp(),
      });
    });
    }
    if (import.meta.env.DEV) {
      console.info("[StudioShelf/repository] transaction-complete", {
        projectId: targetProjectId,
        version,
      });
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("[StudioShelf/repository] failed", { error });
    }
    // A callable can commit and lose its response. Do not delete its staged
    // files on an ambiguous network failure: they may now be the live version.
    if (!overwrite) await Promise.all(
      files.map(async ({ path }) =>
        deleteObject(ref(galleryStorage, path)).catch(() => undefined),
      ),
    );
    if (error instanceof Error) throw error;
    throw new Error("The gallery save failed.", { cause: error });
  }

  const project = await getGalleryProject(uid, targetProjectId);
  if (!project)
    throw new Error("The saved gallery project could not be loaded.");
  return { project, versionId, version, designPath };
}
