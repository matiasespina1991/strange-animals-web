/** Do not let failure cleanup race with uploads still writing their objects. */
export async function settleUploads<T>(uploads: readonly Promise<T>[]): Promise<void> {
  const results = await Promise.allSettled(uploads);
  const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failed) throw failed.reason;
}
