import { collection, getDocs, query, where } from "firebase/firestore";
import { firebaseDb } from "@/lib/firebase";
import type { DesignConfiguratorAsset } from "./asset-library";

type AssetDocument = {
  assetGroup?: unknown;
  assetGroupLabel?: unknown;
  contentType?: unknown;
  downloadUrl?: unknown;
  enabled?: unknown;
  folderPath?: unknown;
  imageRatio?: unknown;
  sourceFileName?: unknown;
  sourcePath?: unknown;
  storagePath?: unknown;
  title?: unknown;
};

export async function listDesignConfiguratorAssets() {
  const snapshot = await getDocs(
    query(
      collection(firebaseDb, "images"),
      where("assetType", "==", "designConfigurator"),
    ),
  );

  return snapshot.docs.flatMap((document) => {
    const data = document.data() as AssetDocument;
    if (
      !data.enabled ||
      (data.assetGroup !== "hvnter" && data.assetGroup !== "bitmancer") ||
      typeof data.assetGroupLabel !== "string" ||
      typeof data.downloadUrl !== "string" ||
      !data.downloadUrl.startsWith("https://firebasestorage.googleapis.com/") ||
      data.contentType !== "image/svg+xml" ||
      typeof data.folderPath !== "string" ||
      typeof data.imageRatio !== "number" ||
      typeof data.sourceFileName !== "string" ||
      typeof data.storagePath !== "string" ||
      !data.storagePath.startsWith(
        "media/public/design-configurator-assets/",
      ) ||
      typeof data.title !== "string"
    ) {
      return [];
    }

    return [
      {
        id: document.id,
        assetGroup: data.assetGroup,
        assetGroupLabel: data.assetGroupLabel,
        contentType: data.contentType,
        downloadUrl: data.downloadUrl,
        folderPath: data.folderPath,
        imageRatio: data.imageRatio,
        name: data.title,
        sourceFileName: data.sourceFileName,
        sourcePath: typeof data.sourcePath === "string" ? data.sourcePath : "",
        storagePath: data.storagePath,
      } satisfies DesignConfiguratorAsset,
    ];
  });
}
