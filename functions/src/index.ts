import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions";
import { HttpsError, onCall, onRequest } from "firebase-functions/https";

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10, region: "europe-west3" });

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

export const health = onRequest({ invoker: "private" }, (request, response) => {
  response.json({ ok: true });
});

export const setWebampSkinStaffPick = onCall(async (request) => {
  const skinId =
    typeof request.data?.skinId === "string" ? request.data.skinId.trim() : "";
  const isStaffPick = request.data?.isStaffPick;

  if (!skinId) {
    throw new HttpsError(
      "invalid-argument",
      "skinId must be a non-empty string",
    );
  }

  if (typeof isStaffPick !== "boolean") {
    throw new HttpsError("invalid-argument", "isStaffPick must be a boolean");
  }

  await db.collection("webampSkins").doc(skinId).set(
    {
      isStaffPick,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { ok: true, skinId, isStaffPick };
});
