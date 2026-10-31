import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import {onCall} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onObjectFinalized} from "firebase-functions/v2/storage";
import {overwriteGalleryVersion} from "./design-version-save";
import {
  cleanupDeletedProjectUpload,
  deleteProjectPage,
  renameProject,
  requestDeletion,
} from "./design-gallery-service";

const app = getApps()[0] ?? initializeApp();
const db = getFirestore(app);
const serviceAccount =
  "vinyl-gallery-runtime@strange-animals-web.iam.gserviceaccount.com";
export const saveDesignVersion = onCall(
  {region: "europe-west3", maxInstances: 3, serviceAccount,
    invoker: "private"},
  (request) => overwriteGalleryVersion(
    db, getStorage(app).bucket("strange-animals-web.firebasestorage.app"),
    request.auth?.uid, request.data,
  ),
);
// Transport access is configured separately on the save, rename and deletion
// Cloud Run services. Firebase Auth remains mandatory inside every handler.
export const requestProjectDeletion = onCall(
  {region: "europe-west3", maxInstances: 3, serviceAccount,
    invoker: "private"},
  (request) => requestDeletion(db, request.auth?.uid, request.data),
);
export const renameDesignProject = onCall(
  {region: "europe-west3", maxInstances: 3, serviceAccount,
    invoker: "private"},
  (request) => renameProject(db, request.auth?.uid, request.data),
);

// A committed job does not depend on an HTTP response or browser staying open.
export const processDesignDeletions = onSchedule(
  {
    schedule: "every 1 minutes",
    region: "europe-west3",
    maxInstances: 1,
    timeoutSeconds: 300,
    retryCount: 3,
    serviceAccount,
  },
  async () => {
    const jobs = await db
      .collection("designDeletionJobs")
      .where("nextAttemptAt", "<=", Timestamp.now())
      .orderBy("nextAttemptAt")
      .limit(20)
      .get();
    for (const job of jobs.docs) {
      try {
        await deleteProjectPage(db, getStorage(app).bucket(), job.id);
      } catch {
        console.error("[DesignDeletion] Page deferred", {jobId: job.id});
      }
    }
  },
);
export const cleanupLateDesignUploads = onObjectFinalized(
  {region: "europe-west3", retry: true, maxInstances: 3, serviceAccount},
  async (event) => {
    const {name, generation, bucket} = event.data;
    if (
      !name ||
      !generation ||
      !name.startsWith("media/private/design-gallery/")
    ) {
      return;
    }
    await cleanupDeletedProjectUpload(
      db,
      getStorage(app).bucket(bucket),
      name,
      String(generation),
    );
  },
);
