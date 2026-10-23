export type InsertableAsset = {
  name: string;
  image: string;
  imageRatio: number;
  width: number;
  imageRole?: "brand-logo" | "barcode";
  imageBarSource?: { bars: string; background: string };
};

export type DesignConfiguratorAsset = {
  id: string;
  assetGroup: "hvnter" | "bitmancer";
  assetGroupLabel: string;
  contentType: "image/svg+xml";
  downloadUrl: string;
  folderPath: string;
  imageRatio: number;
  name: string;
  sourceFileName: string;
  sourcePath: string;
  storagePath: string;
};

export const BRAND_ASSETS = [
  { id: "logo", name: "Strange Animals logo", url: "/media/images/logos/sa-logo.png" },
  { id: "logo-outlined", name: "Strange Animals outlined", url: "/media/images/logos/sa-logo-outlined.png" },
] as const;

async function makeInsertableAsset(name: string, blob: Blob) {
  const image = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read this asset."));
    reader.readAsDataURL(blob);
  });
  const decoded = new Image();
  await new Promise<void>((resolve, reject) => {
    decoded.onload = () => resolve();
    decoded.onerror = () => reject(new Error("Could not decode this asset."));
    decoded.src = image;
  });
  return {
    name,
    image,
    imageRatio: decoded.naturalWidth / decoded.naturalHeight,
    width: 180,
  } satisfies InsertableAsset;
}

/** Embed local assets so saved projects and exports remain portable. */
export async function loadBrandAsset(
  asset: typeof BRAND_ASSETS[number],
): Promise<InsertableAsset> {
  const response = await fetch(asset.url);
  if (!response.ok) throw new Error("Could not load this asset. Please retry.");
  return { ...await makeInsertableAsset(asset.name, await response.blob()), imageRole: "brand-logo" };
}

function sanitizeSvg(source: string) {
  const unsafeCssUrl = /url\(\s*["']?(?!#|data:image\/(?:png|jpeg|webp);base64,)/i;
  const cleanedSource = source
    .replace(/<\?xml[\s\S]*?\?>\s*/i, "")
    .replace(/<!DOCTYPE[\s\S]*?>\s*/i, "");
  const parsed = new DOMParser().parseFromString(
    cleanedSource,
    "image/svg+xml",
  );
  if (
    parsed.querySelector("parsererror") ||
    parsed.documentElement.localName.toLowerCase() !== "svg"
  ) {
    throw new Error("This SVG file is not valid.");
  }

  parsed
    .querySelectorAll("script, foreignObject, iframe, object, embed")
    .forEach((element) => element.remove());
  parsed.querySelectorAll("style").forEach((style) => {
    if (/@import\b/i.test(style.textContent ?? "") || unsafeCssUrl.test(style.textContent ?? ""))
      style.remove();
  });

  for (const element of parsed.querySelectorAll("*")) {
    for (const attribute of Array.from(element.attributes)) {
      const attributeName = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (attributeName.startsWith("on")) {
        element.removeAttribute(attribute.name);
      } else if (
        (attributeName === "href" || attributeName === "xlink:href") &&
        value &&
        !value.startsWith("#") &&
        !/^data:image\/(?:png|jpeg|webp);base64,/i.test(value)
      ) {
        element.removeAttribute(attribute.name);
      } else if (
        attributeName === "style" &&
        unsafeCssUrl.test(value)
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  return new XMLSerializer().serializeToString(parsed.documentElement);
}

export async function loadDesignConfiguratorAsset(
  asset: DesignConfiguratorAsset,
): Promise<InsertableAsset> {
  const response = await fetch(asset.downloadUrl);
  if (!response.ok) throw new Error("Could not load this SVG asset. Please retry.");
  const svg = sanitizeSvg(await response.text());
  return makeInsertableAsset(
    asset.name,
    new Blob([svg], { type: "image/svg+xml" }),
  );
}
