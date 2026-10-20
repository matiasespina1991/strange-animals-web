/** Set physical pixel density without recompressing image data or losing alpha. */
export function setPngResolution(bytes: Uint8Array, ppi: number): Uint8Array<ArrayBuffer> {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((value, index) => bytes[index] === value)) throw new Error("Invalid PNG signature.");
  if (!Number.isFinite(ppi) || ppi <= 0) throw new Error("Invalid PNG resolution.");
  const density = Math.round(ppi / 0.0254);
  const chunk = new Uint8Array(21);
  const header = new DataView(chunk.buffer);
  header.setUint32(0, 9);
  chunk.set([112, 72, 89, 115], 4); // pHYs
  header.setUint32(8, density);
  header.setUint32(12, density);
  chunk[16] = 1; // meters
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, 17)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  header.setUint32(17, (crc ^ 0xffffffff) >>> 0);
  const parts = [bytes.subarray(0, 8)];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let hasHeader = false;
  for (let offset = 8; offset < bytes.length;) {
    if (offset + 12 > bytes.length) throw new Error("Truncated PNG chunk.");
    const end = offset + 12 + view.getUint32(offset);
    if (end > bytes.length) throw new Error("Truncated PNG data.");
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (type !== "pHYs") parts.push(bytes.subarray(offset, end));
    if (type === "IHDR") { parts.push(chunk); hasHeader = true; }
    offset = end;
  }
  if (!hasHeader) throw new Error("PNG header missing.");
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
