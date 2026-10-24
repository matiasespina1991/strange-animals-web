import {useEffect, useState} from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  FolderPlus,
  Pencil,
} from 'lucide-react';
import {AccountControl} from './AccountControl';
import {accountAuth} from './account-auth';
import {
  downloadGalleryModel,
  listGalleryProjects,
  listGalleryVersions,
  loadGalleryImage,
  type GalleryProject,
  type GalleryVersion,
} from './design-gallery-repository';
import './my-gallery.css';

type PreviewImages = {front: string; back: string};
type GalleryTab = 'versions' | 'models';

function dateLabel(date?: Date) {
  if (!date) return 'Just now';
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function modelPreviewHref(projectId: string, versionId: string) {
  const parameters = new URLSearchParams({projectId, versionId});
  return `/identity/my-gallery/model?${parameters.toString()}`;
}

function openInConfigurator(projectId: string, versionId: string) {
  const parameters = new URLSearchParams({projectId, versionId});
  window.location.assign(
    `/identity/design-configurator?${parameters.toString()}`,
  );
}

function Artwork({
  images,
  title,
  className = '',
}: {
  images?: PreviewImages;
  title: string;
  className?: string;
}) {
  return (
    <div className={`mg-artwork ${className}`}>
      {images ? (
        <>
          <img
            className="mg-face-a"
            src={images.front}
            alt={`${title}, front`}
          />
          <img className="mg-face-b" src={images.back} alt={`${title}, back`} />
        </>
      ) : (
        <span className="mg-artwork-placeholder">SA</span>
      )}
      <small>
        A / FRONT <i>B / BACK</i>
      </small>
    </div>
  );
}

export default function MyGalleryPage() {
  const user = accountAuth.currentUser;
  const [projects, setProjects] = useState<GalleryProject[]>([]);
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
  const [tab, setTab] = useState<GalleryTab>('versions');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyModelId, setBusyModelId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    let active = true;
    const objectUrls: string[] = [];
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const nextProjects = await listGalleryProjects(user.uid);
        if (!active) return;
        setProjects(nextProjects);
        setSelectedProjectId((current) =>
          current && nextProjects.some((project) => project.id === current)
            ? current
            : (nextProjects[0]?.id ?? null),
        );
        const previews = await Promise.all(
          nextProjects.map(async (project) => {
            const [frontBlob, backBlob] = await Promise.all([
              loadGalleryImage(project.frontPreviewPath),
              loadGalleryImage(project.backPreviewPath),
            ]);
            const images = {
              front: URL.createObjectURL(frontBlob),
              back: URL.createObjectURL(backBlob),
            };
            objectUrls.push(images.front, images.back);
            return [project.id, images] as const;
          }),
        );
        if (active) setProjectImages(Object.fromEntries(previews));
      } catch (error_) {
        if (active) {
          setError(
            error_ instanceof Error
              ? error_.message
              : 'Your gallery could not be loaded.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      for (const url of objectUrls) URL.revokeObjectURL(url);
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
      setError('');
      try {
        const nextVersions = await listGalleryVersions(
          user.uid,
          selectedProjectId,
        );
        const previews = await Promise.all(
          nextVersions.map(async (version) => {
            const [frontBlob, backBlob] = await Promise.all([
              loadGalleryImage(version.frontPreviewPath),
              loadGalleryImage(version.backPreviewPath),
            ]);
            const images = {
              front: URL.createObjectURL(frontBlob),
              back: URL.createObjectURL(backBlob),
            };
            objectUrls.push(images.front, images.back);
            return [version.id, images] as const;
          }),
        );
        if (active) {
          setVersions(nextVersions);
          setVersionImages(Object.fromEntries(previews));
        }
      } catch (error_) {
        if (active) {
          setError(
            error_ instanceof Error
              ? error_.message
              : "This design's versions could not be loaded.",
          );
        }
      } finally {
        if (active) setDetailLoading(false);
      }
    })();

    return () => {
      active = false;
      for (const url of objectUrls) URL.revokeObjectURL(url);
    };
  }, [selectedProjectId, user]);

  const selectedProject = projects.find(
    (project) => project.id === selectedProjectId,
  );

  const downloadModel = async (version: GalleryVersion) => {
    if (!user || busyModelId) return;
    setBusyModelId(version.id);
    setError('');
    try {
      const blob = await downloadGalleryModel(version.modelPath);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = version.modelFileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error_) {
      setError(
        error_ instanceof Error
          ? error_.message
          : 'The GLB could not be downloaded.',
      );
    } finally {
      setBusyModelId(null);
    }
  };

  return (
    <main className="mg-page">
      <header className="mg-header">
        <a
          href="/identity/design-configurator"
          aria-label="Back to the design configurator"
        >
          <img src="/media/images/logos/sa-logo.png" alt="Strange Animals" />
        </a>
        <div className="mg-header-actions">
          <a href="/identity/design-configurator">
            <FolderPlus size={14} /> New design
          </a>
          <AccountControl />
        </div>
      </header>

      <div className="mg-main">
        <div className="mg-breadcrumb">
          <a href="/identity/design-configurator">
            <ArrowLeft size={13} /> DESIGN CONFIGURATOR
          </a>
          <span>/</span>
          <b>MY GALLERY</b>
        </div>
        <section className="mg-heading">
          <div>
            <p>YOUR PERSONAL DESIGN STUDIO</p>
            <h1>
              My Gallery
              <span>{projects.length.toString().padStart(2, '0')}</span>
            </h1>
          </div>
          <a href="/identity/design-configurator">
            NEW DESIGN <FolderPlus size={15} />
          </a>
        </section>

        {error && (
          <p className="mg-error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p className="mg-message" role="status">
            Loading your gallery…
          </p>
        ) : projects.length === 0 ? (
          <section className="mg-empty">
            <span>01 / YOUR STUDIO</span>
            <h2>Your first design starts here.</h2>
            <p>
              Save a project from the configurator and its versions will live
              here.
            </p>
            <a href="/identity/design-configurator">
              Open design configurator <ArrowUpRight size={14} />
            </a>
          </section>
        ) : (
          <>
            <section className="mg-shelf" aria-label="Your design projects">
              <div className="mg-shelf-heading">
                <span>RECENTLY TOUCHED</span>
                <span>
                  {projects.length.toString().padStart(2, '0')} DESIGNS
                </span>
              </div>
              <div className="mg-records">
                {projects.map((project, index) => (
                  <button
                    className={`mg-record mg-record-${(index % 4) + 1}${project.id === selectedProjectId ? ' is-selected' : ''}`}
                    key={project.id}
                    type="button"
                    aria-pressed={project.id === selectedProjectId}
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      setTab('versions');
                    }}
                  >
                    <Artwork
                      images={projectImages[project.id]}
                      title={project.title}
                    />
                    <b>{project.title}</b>
                    <small>
                      VERSION {project.latestVersion} ·{' '}
                      {dateLabel(project.updatedAt?.toDate())}
                    </small>
                  </button>
                ))}
              </div>
              <div className="mg-shelf-base">
                <span>
                  VERSION {selectedProject?.latestVersion ?? '—'} SHOWN
                </span>
                <span>HOVER TO SEE FRONT / BACK</span>
              </div>
            </section>

            {selectedProject && (
              <section
                className="mg-detail"
                aria-label={`${selectedProject.title} versions and models`}
              >
                <div className="mg-detail-heading">
                  <div>
                    <span>SELECTED DESIGN</span>
                    <h2>{selectedProject.title}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      openInConfigurator(
                        selectedProject.id,
                        versions[0]?.id ?? '',
                      );
                    }}
                  >
                    <Pencil size={14} /> Edit latest version
                  </button>
                </div>
                <div
                  className="mg-tabs"
                  role="tablist"
                  aria-label="Design assets"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'versions'}
                    onClick={() => {
                      setTab('versions');
                    }}
                  >
                    Design versions <span>{versions.length}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'models'}
                    onClick={() => {
                      setTab('models');
                    }}
                  >
                    3D Models <span>{versions.length}</span>
                  </button>
                </div>
                {detailLoading ? (
                  <p className="mg-message" role="status">
                    Loading design history…
                  </p>
                ) : tab === 'versions' ? (
                  <div className="mg-version-list" role="tabpanel">
                    {versions.map((version) => (
                      <article className="mg-version-row" key={version.id}>
                        <button
                          type="button"
                          className="mg-version-preview"
                          onClick={() => {
                            openInConfigurator(selectedProject.id, version.id);
                          }}
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
                          onClick={() => {
                            openInConfigurator(selectedProject.id, version.id);
                          }}
                        >
                          <b>Version {version.version}</b>
                          <small>
                            {dateLabel(version.createdAt?.toDate())}
                          </small>
                        </button>
                        <span className="mg-version-size">
                          {version.modelSizeBytes.toLocaleString()} bytes · GLB
                        </span>
                        <button
                          className="mg-icon-action"
                          type="button"
                          onClick={() => {
                            openInConfigurator(selectedProject.id, version.id);
                          }}
                          aria-label={`Edit version ${version.version}`}
                        >
                          <Pencil size={15} />
                        </button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="mg-model-list" role="tabpanel">
                    <div className="mg-model-columns">
                      <span>3D MODEL</span>
                      <span>VERSION</span>
                      <span>CREATED</span>
                      <span>ACTION</span>
                    </div>
                    {versions.map((version) => (
                      <article className="mg-model-row" key={version.id}>
                        <a
                          className="mg-model-preview"
                          href={modelPreviewHref(
                            selectedProject.id,
                            version.id,
                          )}
                          aria-label={`Preview ${selectedProject.title} version ${version.version}`}
                        >
                          <Artwork
                            images={versionImages[version.id]}
                            title={`${selectedProject.title}, version ${version.version}`}
                          />
                          <span>
                            <b>{selectedProject.title}</b>
                            <small>MODEL / GLB</small>
                          </span>
                        </a>
                        <span>Version {version.version}</span>
                        <span>{dateLabel(version.createdAt?.toDate())}</span>
                        <div className="mg-model-actions">
                          <button
                            type="button"
                            onClick={async () => downloadModel(version)}
                            disabled={busyModelId !== null}
                          >
                            <Download size={14} />{' '}
                            {busyModelId === version.id
                              ? 'Preparing…'
                              : 'Download 3D model (.glb)'}
                          </button>
                          <a
                            href={modelPreviewHref(
                              selectedProject.id,
                              version.id,
                            )}
                            aria-label={`Open 3D preview of version ${version.version}`}
                          >
                            <ArrowUpRight size={15} />
                          </a>
                        </div>
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
