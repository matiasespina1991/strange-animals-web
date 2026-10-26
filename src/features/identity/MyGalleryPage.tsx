import { useEffect, useState, type MouseEvent } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  FolderPlus,
  Pencil,
} from "lucide-react";
import {
  listSharedModels,
  type SharedModel,
} from "../ar-model/model-share-repository";
import { VINYL_ARTWORK_DESIGNER_PRO_PATH } from "./identity-routes";
import { AccountControl } from "./AccountControl";
import { accountAuth } from "./account-auth";
import {
  listGalleryProjects,
  listGalleryVersions,
  loadGalleryImage,
  type GalleryProject,
  type GalleryVersion,
} from "./design-gallery-repository";
import "./my-gallery.css";

type PreviewImages = {
  front: string;
  back: string;
  frontSleeve?: string;
  backSleeve?: string;
};
type GalleryTab = "designs" | "models";

function dateLabel(date?: Date) {
  if (!date) return "Just now";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function Artwork({
  images,
  title,
  className = "",
}: {
  images?: PreviewImages;
  title: string;
  className?: string;
}) {
  const hasSleevePreview = Boolean(images?.frontSleeve && images.backSleeve);
  const previews = images
    ? [
        { label: "COOKIE", front: images.front, back: images.back },
        ...(images.frontSleeve && images.backSleeve
          ? [
              {
                label: "COOKIE + SLEEVE",
                front: images.frontSleeve,
                back: images.backSleeve,
              },
            ]
          : []),
      ]
    : [];
  return (
    <div
      className={`mg-artwork${hasSleevePreview ? " has-sleeve-preview" : ""} ${className}`}
    >
      {images ? (
        <div
          className={`mg-preview-pair${hasSleevePreview ? " has-sleeve" : ""}`}
        >
          {previews.map((preview) => (
            <div className="mg-preview-surface" key={preview.label}>
              <img
                className="mg-face-a"
                src={preview.front}
                alt={`${title}, ${preview.label}, side A`}
              />
              <img
                className="mg-face-b"
                src={preview.back}
                alt={`${title}, ${preview.label}, side B`}
              />
              <small>
                <span>{preview.label}</span>
                <i>A</i>
                <b>B</b>
              </small>
            </div>
          ))}
        </div>
      ) : (
        <span className="mg-artwork-placeholder">SA</span>
      )}
    </div>
  );
}

export function MyGalleryPage({
  onBack,
  onEditVersion,
}: {
  onBack: () => void;
  onEditVersion: (projectId: string, versionId: string) => void;
}) {
  const user = accountAuth.currentUser;
  const [projects, setProjects] = useState<GalleryProject[]>([]);
  const [sharedModels, setSharedModels] = useState<SharedModel[]>([]);
  const [projectImages, setProjectImages] = useState<
    Record<string, PreviewImages>
  >({});
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [versions, setVersions] = useState<GalleryVersion[]>([]);
  const [versionImages, setVersionImages] = useState<
    Record<string, PreviewImages>
  >({});
  const [tab, setTab] = useState<GalleryTab>("designs");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyModelId, setBusyModelId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    const objectUrls: string[] = [];
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const [nextProjects, nextModels] = await Promise.all([
          listGalleryProjects(user.uid),
          listSharedModels(user.uid),
        ]);
        if (!active) return;
        setProjects(nextProjects);
        setSharedModels(nextModels);
        setSelectedProjectId((current) =>
          current && nextProjects.some((project) => project.id === current)
            ? current
            : (nextProjects[0]?.id ?? null),
        );
        const previews = await Promise.all(
          nextProjects.map(async (project) => {
            const [frontBlob, backBlob, frontSleeveBlob, backSleeveBlob] =
              await Promise.all([
                loadGalleryImage(project.frontPreviewPath),
                loadGalleryImage(project.backPreviewPath),
                project.frontSleevePreviewPath
                  ? loadGalleryImage(project.frontSleevePreviewPath)
                  : Promise.resolve(null),
                project.backSleevePreviewPath
                  ? loadGalleryImage(project.backSleevePreviewPath)
                  : Promise.resolve(null),
              ]);
            const images = {
              front: URL.createObjectURL(frontBlob),
              back: URL.createObjectURL(backBlob),
              ...(frontSleeveBlob && backSleeveBlob
                ? {
                    frontSleeve: URL.createObjectURL(frontSleeveBlob),
                    backSleeve: URL.createObjectURL(backSleeveBlob),
                  }
                : {}),
            };
            objectUrls.push(...Object.values(images));
            return [project.id, images] as const;
          }),
        );
        if (active) setProjectImages(Object.fromEntries(previews));
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Your gallery could not be loaded.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      objectUrls.forEach(URL.revokeObjectURL);
    };
  }, [user]);

  useEffect(() => {
    if (!user || !selectedProjectId) {
      setVersions([]);
      setVersionImages({});
      return;
    }
    let active = true;
    const objectUrls: string[] = [];
    void (async () => {
      setDetailLoading(true);
      setError("");
      try {
        const nextVersions = await listGalleryVersions(
          user.uid,
          selectedProjectId,
        );
        const previews = await Promise.all(
          nextVersions.map(async (version) => {
            const [frontBlob, backBlob, frontSleeveBlob, backSleeveBlob] =
              await Promise.all([
                loadGalleryImage(version.frontPreviewPath),
                loadGalleryImage(version.backPreviewPath),
                version.frontSleevePreviewPath
                  ? loadGalleryImage(version.frontSleevePreviewPath)
                  : Promise.resolve(null),
                version.backSleevePreviewPath
                  ? loadGalleryImage(version.backSleevePreviewPath)
                  : Promise.resolve(null),
              ]);
            const images = {
              front: URL.createObjectURL(frontBlob),
              back: URL.createObjectURL(backBlob),
              ...(frontSleeveBlob && backSleeveBlob
                ? {
                    frontSleeve: URL.createObjectURL(frontSleeveBlob),
                    backSleeve: URL.createObjectURL(backSleeveBlob),
                  }
                : {}),
            };
            objectUrls.push(...Object.values(images));
            return [version.id, images] as const;
          }),
        );
        if (active) {
          setVersions(nextVersions);
          setVersionImages(Object.fromEntries(previews));
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "This design's versions could not be loaded.",
          );
        }
      } finally {
        if (active) setDetailLoading(false);
      }
    })();
    return () => {
      active = false;
      objectUrls.forEach(URL.revokeObjectURL);
    };
  }, [selectedProjectId, user]);

  const selectedProject = projects.find(
    (project) => project.id === selectedProjectId,
  );
  const downloadModel = async (model: SharedModel) => {
    if (busyModelId) return;
    setBusyModelId(model.id);
    setError("");
    try {
      const response = await fetch(model.downloadUrl);
      if (!response.ok)
        throw new Error(`Model download failed (${response.status}).`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = model.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "The GLB could not be downloaded.",
      );
    } finally {
      setBusyModelId(null);
    }
  };
  const backToEditor = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    onBack();
  };

  return (
    <main className="mg-page">
      <header className="mg-header">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Vinyl Artwork Designer Pro"
        >
          <img src="/media/images/logos/sa-logo.png" alt="Strange Animals" />
        </button>
        <div className="mg-header-actions">
          <button type="button" onClick={onBack}>
            <FolderPlus size={14} /> New design
          </button>
          <AccountControl />
        </div>
      </header>
      <div className="mg-main">
        <div className="mg-breadcrumb">
          <button type="button" onClick={onBack}>
            <ArrowLeft size={13} /> VINYL ARTWORK DESIGNER PRO
          </button>
          <span>/</span>
          <b>MY GALLERY</b>
        </div>
        <section className="mg-heading">
          <div>
            <p>YOUR PERSONAL DESIGN STUDIO</p>
            <h1>
              My Gallery{" "}
              <span>{projects.length.toString().padStart(2, "0")}</span>
            </h1>
          </div>
          <button type="button" onClick={onBack}>
            NEW DESIGN <FolderPlus size={15} />
          </button>
        </section>
        <div className="mg-tabs" role="tablist" aria-label="Gallery contents">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "designs"}
            onClick={() => setTab("designs")}
          >
            Designs <span>{projects.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "models"}
            onClick={() => setTab("models")}
          >
            Shared 3D models <span>{sharedModels.length}</span>
          </button>
        </div>
        {error && (
          <p className="mg-error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p className="mg-message" role="status">
            Loading your gallery…
          </p>
        ) : tab === "models" ? (
          sharedModels.length === 0 ? (
            <section className="mg-empty">
              <span>01 / PUBLIC SHARES</span>
              <h2>No shared 3D models yet.</h2>
              <p>
                Open 3D Sleeve Preview and choose Share. The generated GLB and
                public link will appear here.
              </p>
              <button type="button" onClick={onBack}>
                Open Vinyl Artwork Designer Pro <ArrowUpRight size={14} />
              </button>
            </section>
          ) : (
            <div className="mg-model-list" role="tabpanel">
              <div className="mg-model-columns">
                <span>3D MODEL</span>
                <span>SHARED</span>
                <span>FILE</span>
                <span>ACTION</span>
              </div>
              {sharedModels.map((model) => (
                <article className="mg-model-row" key={model.id}>
                  <a
                    className="mg-model-preview"
                    href={`/${model.id}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open public preview of ${model.title}`}
                  >
                    <Artwork title={model.title} />
                    <span>
                      <b>{model.title}</b>
                      <small>PUBLIC MODEL / GLB</small>
                    </span>
                  </a>
                  <span>{dateLabel(model.createdAt.toDate())}</span>
                  <span>{model.fileName}</span>
                  <div className="mg-model-actions">
                    <button
                      type="button"
                      onClick={() => void downloadModel(model)}
                      disabled={busyModelId !== null}
                    >
                      <Download size={14} />{" "}
                      {busyModelId === model.id
                        ? "Preparing…"
                        : "Download .glb"}
                    </button>
                    <a
                      href={`/${model.id}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${model.title}`}
                    >
                      <ArrowUpRight size={15} />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )
        ) : projects.length === 0 ? (
          <section className="mg-empty">
            <span>01 / YOUR STUDIO</span>
            <h2>Your first design starts here.</h2>
            <p>
              Save a project from the configurator and its versions will live
              here.
            </p>
            <button type="button" onClick={onBack}>
              Open Vinyl Artwork Designer Pro <ArrowUpRight size={14} />
            </button>
          </section>
        ) : (
          <>
            <section className="mg-shelf" aria-label="Your design projects">
              <div className="mg-shelf-heading">
                <span>RECENTLY TOUCHED</span>
                <span>
                  {projects.length.toString().padStart(2, "0")} DESIGNS
                </span>
              </div>
              <div className="mg-records">
                {projects.map((project, index) => (
                  <button
                    className={`mg-record mg-record-${(index % 4) + 1}${project.id === selectedProjectId ? " is-selected" : ""}`}
                    key={project.id}
                    type="button"
                    aria-pressed={project.id === selectedProjectId}
                    onClick={() => setSelectedProjectId(project.id)}
                  >
                    <Artwork
                      images={projectImages[project.id]}
                      title={project.title}
                    />
                    <b>{project.title}</b>
                    <small>
                      VERSION {project.latestVersion} ·{" "}
                      {dateLabel(project.updatedAt?.toDate())}
                    </small>
                  </button>
                ))}
              </div>
              <div className="mg-shelf-base">
                <span>
                  VERSION {selectedProject?.latestVersion ?? "—"} SHOWN
                </span>
                <span>HOVER TO SEE FRONT / BACK</span>
              </div>
            </section>
            {selectedProject && (
              <section
                className="mg-detail"
                aria-label={`${selectedProject.title} versions`}
              >
                <div className="mg-detail-heading">
                  <div>
                    <span>SELECTED DESIGN</span>
                    <h2>{selectedProject.title}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onEditVersion(
                        selectedProject.id,
                        selectedProject.latestVersionId,
                      )
                    }
                  >
                    <Pencil size={14} /> Edit latest version
                  </button>
                </div>
                {detailLoading ? (
                  <p className="mg-message" role="status">
                    Loading design history…
                  </p>
                ) : (
                  <div className="mg-version-list" role="tabpanel">
                    {versions.map((version) => (
                      <article className="mg-version-row" key={version.id}>
                        <button
                          type="button"
                          className="mg-version-preview"
                          onClick={() =>
                            onEditVersion(selectedProject.id, version.id)
                          }
                          aria-label={`Edit version ${version.version}`}
                        >
                          <Artwork
                            images={versionImages[version.id]}
                            title={`${selectedProject.title}, version ${version.version}`}
                          />
                        </button>
                        <button
                          type="button"
                          className="mg-version-title"
                          onClick={() =>
                            onEditVersion(selectedProject.id, version.id)
                          }
                        >
                          <b>Version {version.version}</b>
                          <small>
                            {dateLabel(version.createdAt?.toDate())}
                          </small>
                        </button>
                        <span className="mg-version-size">
                          {versionImages[version.id]?.frontSleeve
                            ? "COOKIE · COOKIE + SLEEVE"
                            : "COOKIE · FRONT / BACK"}
                        </span>
                        <button
                          className="mg-icon-action"
                          type="button"
                          onClick={() =>
                            onEditVersion(selectedProject.id, version.id)
                          }
                          aria-label={`Edit version ${version.version}`}
                        >
                          <Pencil size={15} />
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
