import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref,
  uploadBytesResumable,
  type UploadTaskSnapshot,
} from "firebase/storage";
import { firebaseDb, firebaseStorage } from "@/lib/firebase";

export type WebampSkin = {
  isStaffPick: boolean;
  id: string;
  label: string;
  displayName: string;
  storagePath: string;
  downloadUrl: string;
};

export type WebampSkinStaffPickRow = {
  id: string;
  displayName: string;
  enabled: boolean;
  hasStaffPickProperty: boolean;
  isStaffPick: boolean;
  storagePath: string;
};

type WebampSkinDocument = {
  enabled?: boolean;
  isStaffPick?: boolean;
  label?: string;
  storagePath?: string;
  sourceFileName?: string;
  sortOrder?: number;
};

type UploadWebampSkinOptions = {
  file: File;
  onProgress?: (progress: number) => void;
};

type ListWebampSkinsOptions = {
  staffPicksOnly?: boolean;
};

function slugifySkinId(fileName: string) {
  const baseName = fileName.replace(/\.[^/.]+$/, "");
  const slug = baseName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "skin"}-${Date.now().toString(36)}`;
}

function getSkinDisplayName(snapshotId: string, data: WebampSkinDocument) {
  if (data.label?.trim()) {
    return data.label.trim();
  }

  if (data.sourceFileName?.trim()) {
    return data.sourceFileName.trim().replace(/\.[^/.]+$/, "");
  }

  return snapshotId.replace(/-[a-z0-9]{8}$/i, "");
}

async function resolveSkin(snapshotId: string, data: WebampSkinDocument) {
  if (!data.enabled || !data.storagePath) {
    return null;
  }

  return {
    isStaffPick: Boolean(data.isStaffPick),
    id: snapshotId,
    label: data.label ?? "",
    displayName: getSkinDisplayName(snapshotId, data),
    storagePath: data.storagePath,
    downloadUrl: await getDownloadURL(ref(firebaseStorage, data.storagePath)),
  } satisfies WebampSkin;
}

export async function listWebampSkins(options?: ListWebampSkinsOptions) {
  const staffPicksOnly = options?.staffPicksOnly ?? false;
  const snapshot = await getDocs(collection(firebaseDb, "webampSkins"));

  const skins = await Promise.all(
    snapshot.docs
      .sort((left, right) => {
        const leftOrder =
          (left.data() as WebampSkinDocument).sortOrder ??
          Number.MAX_SAFE_INTEGER;
        const rightOrder =
          (right.data() as WebampSkinDocument).sortOrder ??
          Number.MAX_SAFE_INTEGER;

        return leftOrder - rightOrder || left.id.localeCompare(right.id);
      })
      .map(async (documentSnapshot) =>
        resolveSkin(
          documentSnapshot.id,
          documentSnapshot.data() as WebampSkinDocument,
        ),
      ),
  );

  return skins
    .filter((skin): skin is WebampSkin => skin !== null)
    .filter((skin) => (staffPicksOnly ? skin.isStaffPick : true))
    .sort((left, right) =>
      left.displayName.localeCompare(right.displayName, undefined, {
        sensitivity: "base",
      }),
    );
}

export async function listWebampSkinsForStaffPicks() {
  const snapshot = await getDocs(collection(firebaseDb, "webampSkins"));

  const rows = snapshot.docs.map((documentSnapshot) => {
    const data = documentSnapshot.data() as WebampSkinDocument;

    return {
      id: documentSnapshot.id,
      displayName: getSkinDisplayName(documentSnapshot.id, data),
      enabled: Boolean(data.enabled),
      hasStaffPickProperty: Object.prototype.hasOwnProperty.call(
        data,
        "isStaffPick",
      ),
      isStaffPick: Boolean(data.isStaffPick),
      storagePath: data.storagePath ?? "",
    } satisfies WebampSkinStaffPickRow;
  });

  return rows.sort((left, right) =>
    left.displayName.localeCompare(right.displayName, undefined, {
      sensitivity: "base",
    }),
  );
}

export async function setWebampSkinStaffPick(
  skinId: string,
  isStaffPick: boolean,
) {
  await updateDoc(doc(firebaseDb, "webampSkins", skinId), {
    isStaffPick,
    updatedAt: serverTimestamp(),
  });
}

export async function setMissingWebampSkinStaffPicksToTrue() {
  const snapshot = await getDocs(collection(firebaseDb, "webampSkins"));
  const documentsMissingStaffPick = snapshot.docs.filter((documentSnapshot) => {
    const data = documentSnapshot.data() as WebampSkinDocument;

    return !Object.prototype.hasOwnProperty.call(data, "isStaffPick");
  });

  let updatedCount = 0;
  let skippedCount = 0;

  for (const documentSnapshot of documentsMissingStaffPick) {
    const data = documentSnapshot.data() as WebampSkinDocument;
    const canUpdateFromRules =
      data.enabled === true &&
      typeof data.storagePath === "string" &&
      data.storagePath.startsWith("media/public/webamp-skins/");

    if (!canUpdateFromRules) {
      skippedCount += 1;
      continue;
    }

    await updateDoc(documentSnapshot.ref, {
      isStaffPick: true,
      updatedAt: serverTimestamp(),
    });
    updatedCount += 1;
  }

  return {
    totalMissingCount: documentsMissingStaffPick.length,
    updatedCount,
    skippedCount,
  };
}

export async function uploadWebampSkin({
  file,
  onProgress,
}: UploadWebampSkinOptions) {
  const id = slugifySkinId(file.name);
  const storagePath = `media/public/webamp-skins/${id}/v1/${file.name}`;
  const task = uploadBytesResumable(ref(firebaseStorage, storagePath), file, {
    contentType: file.type || "application/octet-stream",
    customMetadata: {
      skinId: id,
      sourceFileName: file.name,
    },
  });

  await new Promise<UploadTaskSnapshot>((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => {
        const progress = snapshot.totalBytes
          ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
          : 0;
        onProgress?.(progress);
      },
      reject,
      () => {
        resolve(task.snapshot);
      },
    );
  });

  await setDoc(doc(firebaseDb, "webampSkins", id), {
    id,
    label: "",
    storagePath,
    sourceFileName: file.name,
    contentType: file.type || "application/octet-stream",
    enabled: true,
    sortOrder: Date.now(),
    version: 1,
    updatedAt: serverTimestamp(),
  });

  return id;
}
