export type InsertableAsset = {
  name: string;
  image: string;
  imageRatio: number;
  width: number;
};

export const BRAND_ASSETS = [
  { id: "logo", name: "Strange Animals logo", url: "/media/images/logos/sa-logo.png" },
  { id: "logo-outlined", name: "Strange Animals outlined", url: "/media/images/logos/sa-logo-outlined.png" },
] as const;

/** Embed local assets so saved projects and exports remain portable. */
export async function loadBrandAsset(asset: typeof BRAND_ASSETS[number]): Promise<InsertableAsset> {
  const response = await fetch(asset.url);
  if (!response.ok) throw new Error("Could not load this asset. Please retry.");
  const blob = await response.blob();
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
  return { name: asset.name, image, imageRatio: decoded.naturalWidth / decoded.naturalHeight, width: 180 };
}
