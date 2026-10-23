export type BarcodePalette = { bars: string; background: string };

/** Barcode quiet zones identify the background; a central scan identifies the bars. */
export function barcodePaletteFromPixels(pixels: Uint8ClampedArray, width: number, height: number): BarcodePalette {
  const rgb = (x: number, y: number) => {
    const offset = (y * width + x) * 4;
    return [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
  };
  const background = rgb(0, 0);
  let bars = background, largestDistance = 0;
  for (const fraction of [0.35, 0.5, 0.65]) {
    const y = Math.min(height - 1, Math.floor(height * fraction));
    for (let x = 0; x < width; x++) {
      const candidate = rgb(x, y);
      const distance = candidate.reduce((sum, value, channel) => sum + (value - background[channel]) ** 2, 0);
      if (distance > largestDistance) { largestDistance = distance; bars = candidate; }
    }
  }
  if (largestDistance < 1) throw new Error("Could not distinguish barcode bars from background.");
  const hex = (channels: number[]) => `#${channels.map(value => value.toString(16).padStart(2, "0")).join("")}`;
  return { bars: hex(bars), background: hex(background) };
}

const palettes = new Map<string, Promise<BarcodePalette>>();
export function readBarcodeSourcePalette(source: string) {
  const cached = palettes.get(source);
  if (cached) return cached;
  const promise = new Promise<BarcodePalette>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(1024, image.naturalWidth);
        canvas.height = Math.min(512, image.naturalHeight);
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("Could not read barcode colors.");
        context.imageSmoothingEnabled = false;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(barcodePaletteFromPixels(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height));
      } catch (error) { reject(error); }
    };
    image.onerror = () => reject(new Error("Could not read barcode image."));
    image.src = source;
  });
  if (palettes.size >= 100) palettes.delete(palettes.keys().next().value!);
  palettes.set(source, promise);
  return promise;
}
