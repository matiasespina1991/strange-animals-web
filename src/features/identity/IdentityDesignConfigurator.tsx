import { useEffect, useState } from "react";
import { DesignConfiguratorEditor } from "./DesignConfiguratorEditor";
import { MyGalleryPage } from "./MyGalleryPage";
import { PersonalAccountGate } from "./PersonalAccountGate";
import { VINYL_DESIGNER_WIZARD_PRO_PATH } from "./identity-routes";

type GallerySelection = { projectId: string; versionId: string };

export function IdentityDesignConfigurator({
  initialView = "editor",
}: {
  initialView?: "editor" | "gallery";
}) {
  const [galleryOpen, setGalleryOpen] = useState(initialView === "gallery");
  const [selection, setSelection] = useState<GallerySelection>();

  useEffect(() => {
    if (initialView !== "gallery") return;
    if (window.location.pathname !== VINYL_DESIGNER_WIZARD_PRO_PATH) {
      window.history.replaceState(
        null,
        "",
        `${VINYL_DESIGNER_WIZARD_PRO_PATH}${window.location.search}${window.location.hash}`,
      );
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, [initialView]);

  return (
    <>
      <div style={{ display: galleryOpen ? "none" : "contents" }}>
        <DesignConfiguratorEditor
          gallerySelection={selection}
          onOpenGallery={() => setGalleryOpen(true)}
        />
      </div>
      {galleryOpen && (
        <PersonalAccountGate>
          <MyGalleryPage
            onBack={() => setGalleryOpen(false)}
            onEditVersion={(projectId, versionId) => {
              setSelection({ projectId, versionId });
              setGalleryOpen(false);
            }}
          />
        </PersonalAccountGate>
      )}
    </>
  );
}
