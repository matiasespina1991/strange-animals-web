export type FontDownloadProgress = {
  phase: "queued" | "downloading" | "decoding";
  loaded: number;
  total: number | null;
};

/** Count actual streamed bytes; never invent a percentage when total size is unknown. */
export async function readFontBytes(
  response: Response,
  signal: AbortSignal,
  maximumBytes: number,
  onProgress: (progress: FontDownloadProgress) => void,
) {
  const length = Number(response.headers.get("content-length"));
  const encoding = response.headers.get("content-encoding");
  const total =
    Number.isFinite(length) &&
    length > 0 &&
    (!encoding || encoding === "identity")
      ? length
      : null;
  if (total !== null && total > maximumBytes) {
    await response.body?.cancel();
    throw new Error("Font exceeds preview size limit");
  }
  signal.throwIfAborted();
  onProgress({ phase: "downloading", loaded: 0, total });
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    signal.throwIfAborted();
    if (bytes.length > maximumBytes)
      throw new Error("Font exceeds preview size limit");
    onProgress({ phase: "downloading", loaded: bytes.length, total });
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  let lastReport = 0;
  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      loaded += value.byteLength;
      if (loaded > maximumBytes) {
        await reader.cancel();
        throw new Error("Font exceeds preview size limit");
      }
      chunks.push(value);
      if (Date.now() - lastReport >= 100) {
        onProgress({ phase: "downloading", loaded, total });
        lastReport = Date.now();
      }
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  onProgress({ phase: "downloading", loaded, total });
  return bytes;
}
