import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { accountAuth } from "@/features/identity/account-auth";

const shareDatabase = getFirestore(accountAuth.app);
const shareStorage = getStorage(accountAuth.app);
const SHARE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_SHARED_MODEL_BYTES = 100 * 1024 * 1024;

export type SharedModel = {
  id: string;
  title: string;
  fileName: string;
  storagePath: string;
  downloadUrl: string;
  createdAt: Timestamp;
};

function readSharedModel(
  id: string,
  data: Record<string, unknown>,
): Omit<SharedModel, "downloadUrl"> | null {
  if (
    data.schemaVersion !== 1 ||
    data.visibility !== "public" ||
    typeof data.ownerUid !== "string" ||
    typeof data.title !== "string" ||
    !data.title.length ||
    data.title.length > 120 ||
    typeof data.fileName !== "string" ||
    !/^[A-Za-z0-9_.-]{1,150}[.]glb$/i.test(data.fileName) ||
    typeof data.storagePath !== "string" ||
    data.storagePath !==
      `media/public/shared-models/${data.ownerUid}/${id}/${data.fileName}` ||
    data.contentType !== "model/gltf-binary" ||
    typeof data.sizeBytes !== "number" ||
    data.sizeBytes < 1 ||
    data.sizeBytes > MAX_SHARED_MODEL_BYTES ||
    !data.createdAt
  ) {
    return null;
  }

  return {
    id,
    title: data.title,
    fileName: data.fileName,
    storagePath: data.storagePath,
    createdAt: data.createdAt as Timestamp,
  };
}

function safeModelFileName(name: string) {
  const baseName = name
    .replace(/\.glb$/i, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150);
  return `${baseName || "model"}.glb`;
}

export async function createModelShare(
  file: File,
  title: string,
  onProgress?: (progress: number) => void,
  modelId?: string,
  preview?: Blob,
) {
  const user = accountAuth.currentUser;
  if (!user) throw Error("Sign in before sharing a 3D model.");
  if (!file.name.toLowerCase().endsWith(".glb"))
    throw Error("Choose a GLB model file.");
  if (!file.size || file.size > MAX_SHARED_MODEL_BYTES)
    throw Error("GLB files must be smaller than 100 MB.");

  if (modelId && !SHARE_ID_PATTERN.test(modelId)) throw Error("Invalid model version ID.");
  const id = modelId ?? crypto.randomUUID();
  const documentReference = doc(shareDatabase, "sharedModels", id);
  const existing = modelId ? await getDoc(documentReference) : null;
  const existingData = existing?.exists() ? existing.data() : null;
  if (existingData && (existingData.ownerUid !== user.uid || !readSharedModel(id, existingData))) {
    throw Error("This shared model cannot be replaced by your account.");
  }
  // Preserve the file path as well as the public ID on every replacement.
  const fileName = existingData ? existingData.fileName as string : safeModelFileName(file.name);
  const storagePath = `media/public/shared-models/${user.uid}/${id}/${fileName}`;
  const storageReference = ref(shareStorage, storagePath);
  const upload = uploadBytesResumable(storageReference, file, {
    contentType: "model/gltf-binary",
    cacheControl: "no-cache, max-age=0",
  });

  await new Promise<void>((resolve, reject) => {
    upload.on(
      "state_changed",
      (snapshot) => {
        onProgress?.(snapshot.bytesTransferred / snapshot.totalBytes);
      },
      reject,
      resolve,
    );
  });

  if (preview) {
    if (preview.type !== "image/png" || !preview.size || preview.size > 5 * 1024 * 1024) {
      throw Error("The model preview must be a PNG smaller than 5 MB.");
    }
    const previewUpload = uploadBytesResumable(
      ref(shareStorage, `media/public/shared-models/${user.uid}/${id}/preview.png`),
      preview,
      { contentType: "image/png", cacheControl: "no-cache, max-age=0" },
    );
    await previewUpload;
  }

  try {
    await setDoc(documentReference, {
      schemaVersion: 1,
      visibility: "public",
      ownerUid: user.uid,
      title: title.trim().slice(0, 120) || fileName.replace(/\.glb$/i, ""),
      fileName,
      storagePath,
      contentType: "model/gltf-binary",
      sizeBytes: file.size,
      createdAt: existingData?.createdAt ?? serverTimestamp(),
    });
  } catch (error) {
    // Never delete a version's existing model if its metadata update fails.
    // Stable IDs can also be shared concurrently from another tab.
    if (!modelId) await deleteObject(storageReference).catch(() => undefined);
    throw error;
  }

  return { id, fileName, storagePath };
}

export async function getSharedModel(id: string): Promise<SharedModel | null> {
  if (!SHARE_ID_PATTERN.test(id)) return null;
  const snapshot = await getDoc(doc(shareDatabase, "sharedModels", id));
  if (!snapshot.exists()) return null;

  const model = readSharedModel(snapshot.id, snapshot.data());
  if (!model) return null;

  return {
    ...model,
    downloadUrl: await getDownloadURL(ref(shareStorage, model.storagePath)),
  };
}

export async function listSharedModels(uid: string): Promise<SharedModel[]> {
  const snapshot = await getDocs(
    query(
      collection(shareDatabase, "sharedModels"),
      where("ownerUid", "==", uid),
    ),
  );
  const records = snapshot.docs
    .map((document) => readSharedModel(document.id, document.data()))
    .filter(
      (model): model is Omit<SharedModel, "downloadUrl"> => model !== null,
    )
    .sort(
      (left, right) => right.createdAt.toMillis() - left.createdAt.toMillis(),
    );
  return Promise.all(
    records.map(async (model) => ({
      ...model,
      downloadUrl: await getDownloadURL(ref(shareStorage, model.storagePath)),
    })),
  );
}
