/** Log storage failure metadata only; never serialize the user's artwork. */
export function reportRecoveryFailure(error: unknown, serialized: string, key: string) {
  let storageCharacters: number | undefined;
  let existingRecoveryCharacters: number | undefined;
  try {
    storageCharacters = 0;
    existingRecoveryCharacters = localStorage.getItem(key)?.length ?? 0;
    for (let i = 0; i < localStorage.length; i++) {
      const name = localStorage.key(i);
      if (name) storageCharacters += name.length + (localStorage.getItem(name)?.length ?? 0);
    }
  } catch { /* Storage may be inaccessible, not merely full. */ }
  console.error("[StudioShelf/recovery] write-failed", {
    error,
    errorName: error instanceof Error ? error.name : "Unknown",
    recoveryKey: key,
    projectUtf8Bytes: new Blob([serialized]).size,
    projectUtf16Bytes: serialized.length * 2,
    existingRecoveryUtf16Bytes: existingRecoveryCharacters === undefined ? undefined : existingRecoveryCharacters * 2,
    localStorageApproxUtf16Bytes: storageCharacters === undefined ? undefined : storageCharacters * 2,
    cloudSaveAffected: false,
  });
  // This quota covers origin storage, not the separate localStorage limit.
  if (navigator.storage?.estimate) {
    void navigator.storage.estimate().then(({usage, quota}) => {
      console.info("[StudioShelf/recovery] origin-storage-estimate", {
        usageBytes: usage, quotaBytes: quota,
        note: "Origin quota is not the localStorage quota.",
      });
    }).catch(error => {
      console.warn("[StudioShelf/recovery] quota-estimate-unavailable", {error});
    });
  }
}
