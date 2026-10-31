import type { Texture } from "three";
import type { GLTFExporterPlugin, GLTFWriter } from "three/addons/exporters/GLTFExporter.js";

// Isolated adapter for the Three r171 writer methods used by this extension.
type WebpWriter = GLTFWriter & {
  json: {
    images?: { mimeType: string; bufferView: number }[];
    textures?: Record<string, unknown>[];
  };
  processSampler(texture: Texture): number;
  processBufferViewImage(blob: Blob): Promise<number>;
};

/** Encode artwork only; numeric maps keep the standard lossless PNG path. */
export function vinylWebpPlugin(base: GLTFWriter): GLTFExporterPlugin {
  const writer = base as WebpWriter;
  const original = writer.processTextureAsync.bind(writer);
  const textures = new Map<Texture, Promise<number>>();
  const images = new Map<object, Map<boolean, Promise<number>>>();
  writer.processTextureAsync = (texture) => {
    if (!texture.userData.vinylWebp) return original(texture);
    const cached = textures.get(texture);
    if (cached) return cached;
    const pending = encode(texture);
    textures.set(texture, pending);
    return pending;
  };

  async function encode(texture: Texture): Promise<number> {
    const image = texture.image as HTMLCanvasElement;
    let variants = images.get(image);
    if (!variants) images.set(image, variants = new Map());
    let pending = variants.get(texture.flipY);
    if (!pending) {
      pending = encodeImage(image, texture.flipY);
      variants.set(texture.flipY, pending);
    }
    const source = await pending;
    writer.extensionsUsed.EXT_texture_webp = true;
    writer.extensionsRequired.EXT_texture_webp = true;
    const definition: Record<string, unknown> = {
      sampler: writer.processSampler(texture),
      extensions: { EXT_texture_webp: { source } },
    };
    if (texture.name) definition.name = texture.name;
    writer.json.textures ??= [];
    return writer.json.textures.push(definition) - 1;
  }

  async function encodeImage(image: HTMLCanvasElement, flipY: boolean) {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) throw Error("Canvas unavailable for WebP export.");
    if (flipY) {
      context.translate(0, canvas.height);
      context.scale(1, -1);
    }
    context.drawImage(image, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(result => {
        if (!result || result.type !== "image/webp") {
          reject(Error("This browser cannot export WebP. Remove glbWebp=1 to use PNG/JPEG."));
        } else resolve(result);
      }, "image/webp", 0.94);
    });
    const bufferView = await writer.processBufferViewImage(blob);
    writer.json.images ??= [];
    return writer.json.images.push({ mimeType: "image/webp", bufferView }) - 1;
  }
  return {};
}
