import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ArrowUpLeft, Check, Copy, Share2, Upload } from "lucide-react";
import { AccountControl } from "@/features/identity/AccountControl";
import { accountAuth } from "@/features/identity/account-auth";
import { VINYL_ARTWORK_DESIGNER_PRO_PATH } from "@/features/identity/identity-routes";
import {
  downloadGalleryModel,
  getGalleryProject,
  getGalleryVersion,
} from "@/features/identity/design-gallery-repository";
import {
  createModelShare,
  getSharedModel,
  MAX_SHARED_MODEL_BYTES,
} from "./model-share-repository";
import "./ar-model-page.css";

const DEFAULT_GLB_URL =
  "https://firebasestorage.googleapis.com/v0/b/vr-ar-visualizator.appspot.com/o/models%2Fazucenas.glb?alt=media&token=ca92f9b9-2f2c-489f-98d9-f931c8b87566";
const MODEL_VIEWER_SCRIPT =
  "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
let modelViewerPromise: Promise<void> | null = null;

type ARModelPageProperties = {
  shareId?: string;
  galleryModel?: { projectId: string; versionId: string };
};

function ensureModelViewer() {
  if (customElements.get("model-viewer")) return Promise.resolve();
  if (modelViewerPromise) return modelViewerPromise;

  modelViewerPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-ar-model-viewer="true"]',
    );
    const script = existing ?? document.createElement("script");
    if (!existing) {
      script.type = "module";
      script.src = MODEL_VIEWER_SCRIPT;
      script.dataset.arModelViewer = "true";
    }
    const handleLoad = () => {
      script.dataset.loaded = "true";
      void customElements.whenDefined("model-viewer").then(() => resolve(), reject);
    };
    const handleError = () => {
      modelViewerPromise = null;
      reject(Error("Model viewer could not load."));
    };
    if (script.dataset.loaded === "true") {
      handleLoad();
      return;
    }
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    if (!existing) document.head.append(script);
  });
  return modelViewerPromise;
}

export default function ARModelPage({
  shareId,
  galleryModel,
}: ARModelPageProperties) {
  const viewerHost = useRef<HTMLDivElement>(null);
  const modelObjectUrl = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [modelSource, setModelSource] = useState(
    shareId || galleryModel ? "" : DEFAULT_GLB_URL,
  );
  const [modelTitle, setModelTitle] = useState("Azucenas");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewerError, setViewerError] = useState("");
  const [modelLoadProgress, setModelLoadProgress] = useState<number | null>(null);
  const [pageError, setPageError] = useState("");
  const [pageLoading, setPageLoading] = useState(
    Boolean(shareId || galleryModel),
  );
  const [accountReady, setAccountReady] = useState(false);
  const [signedIn, setSignedIn] = useState(Boolean(accountAuth.currentUser));
  const [sharing, setSharing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sharedUrl, setSharedUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [previewCopied, setPreviewCopied] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");

  useEffect(() => {
    if (!shareId) document.title = galleryModel
        ? "My Gallery model | Strange Animals"
        : "3D AR preview | Strange Animals";
    return onAuthStateChanged(accountAuth, (user) => {
      setSignedIn(Boolean(user));
      setAccountReady(true);
    });
  }, [galleryModel, shareId]);

  useEffect(() => {
    if (!shareId || !modelSource) return;
    const title = `Strange Animals | 3D Record | ${modelTitle}`;
    const description = `Interactive 3D view of ${modelTitle}. Explore the artwork, materials and print finishes from different angles.`;
    const image = `https://strangeanimals.de/_model-preview/${shareId}`;
    const values: Record<string, string> = {
      description, "og-title": title, "og-description": description,
      "og-image": image, "og-image-alt": `${modelTitle} — 3D model preview`,
      "twitter-title": title, "twitter-description": description, "twitter-image": image,
    };
    const previousTitle = document.title;
    document.title = title;
    const previous = Object.entries(values).map(([key, value]) => {
      const element = document.querySelector<HTMLMetaElement>(`meta[data-route-meta="${key}"]`);
      const content = element?.content;
      if (element) element.content = value;
      return {element, content};
    });
    return () => {
      document.title = previousTitle;
      for (const {element, content} of previous) if (element && content !== undefined) element.content = content;
    };
  }, [shareId, modelSource, modelTitle]);

  useEffect(() => {
    if (!shareId) return;
    let active = true;
    setPageLoading(true);
    setPageError("");
    void getSharedModel(shareId)
      .then((model) => {
        if (!active) return;
        if (!model) {
          setPageError("This shared model could not be found.");
          return;
        }
        setModelTitle(model.title);
        setModelSource(model.downloadUrl);
      })
      .catch(() => {
        if (active) setPageError("This shared model could not be loaded.");
      })
      .finally(() => {
        if (active) setPageLoading(false);
      });
    return () => {
      active = false;
    };
  }, [shareId]);

  useEffect(() => {
    if (!galleryModel) return;
    let active = true;
    let objectUrl: string | null = null;
    setPageLoading(true);
    setPageError("");
    void (async () => {
      try {
        const user = accountAuth.currentUser;
        if (!user) throw Error("Sign in to open this private 3D model.");
        const [project, version] = await Promise.all([
          getGalleryProject(user.uid, galleryModel.projectId),
          getGalleryVersion(
            user.uid,
            galleryModel.projectId,
            galleryModel.versionId,
          ),
        ]);
        if (!project || !version?.modelPath)
          throw Error("This model version could not be found in your gallery.");
        const blob = await downloadGalleryModel(version.modelPath);
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        modelObjectUrl.current = objectUrl;
        setModelTitle(`${project.title} · v${version.version}`);
        setModelSource(objectUrl);
      } catch (cause) {
        if (active) {
          setPageError(
            cause instanceof Error
              ? cause.message
              : "This private model could not be loaded.",
          );
        }
      } finally {
        if (active) setPageLoading(false);
      }
    })();
    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        if (modelObjectUrl.current === objectUrl) modelObjectUrl.current = null;
      }
    };
  }, [galleryModel?.projectId, galleryModel?.versionId]);

  useEffect(() => {
    const host = viewerHost.current;
    if (!host || !modelSource) return;
    let active = true;
    setViewerError("");
    setModelLoadProgress(0);
    void ensureModelViewer()
      .then(() => {
        if (!active) return;
        const viewer = document.createElement("model-viewer");
        viewer.setAttribute("src", modelSource);
        // Vinyl exports already contain their physical scale. Applying it
        // here again would shrink them twice, and Scene Viewer loads the GLB
        // directly, bypassing transforms set only on this web component.
        viewer.setAttribute("camera-controls", "");
        viewer.setAttribute("auto-rotate", "");
        viewer.setAttribute("autoplay", "");
        viewer.setAttribute("ar", "");
        viewer.setAttribute("ar-modes", "scene-viewer webxr quick-look");
        viewer.setAttribute("shadow-intensity", "1");
        viewer.setAttribute("loading", "eager");
        viewer.setAttribute("alt", `${modelTitle} 3D model`);
        if (modelSource.startsWith("blob:")) {
          viewer.setAttribute("crossorigin", "anonymous");
        }
        viewer.className = "ar-model-viewer-element";
        let loaded = false;
        viewer.addEventListener("progress", (event) => {
          if (!active || loaded) return;
          const detail = (event as unknown as CustomEvent<{
            totalProgress: number;
            reason?: string;
          }>).detail;
          if (detail?.reason && detail.reason !== "model-load") return;
          if (!Number.isFinite(detail?.totalProgress)) return;
          // Completion means the first rendered frame, not merely download.
          const percent = Math.min(99, Math.max(0, Math.floor(detail.totalProgress * 100)));
          setModelLoadProgress(previous => previous === null ? null : Math.max(previous, percent));
        });
        viewer.addEventListener("load", () => {
          loaded = true;
          if (active) setModelLoadProgress(null);
        });
        viewer.addEventListener("error", () => {
          loaded = true;
          if (active) {
            setModelLoadProgress(null);
            setViewerError(
              "The model URL could not be loaded. Choose the original GLB file to preview and share it.",
            );
          }
        });
        const arButton = document.createElement("button");
        arButton.slot = "ar-button";
        arButton.className = "ar-model-ar-button";
        arButton.textContent = "Ver en tu espacio";
        viewer.append(arButton);
        host.replaceChildren(viewer);
      })
      .catch(() => {
        if (active) {
          setModelLoadProgress(null);
          setViewerError("The 3D viewer could not be loaded.");
        }
      });
    return () => {
      active = false;
      host.replaceChildren();
    };
  }, [modelSource, modelTitle]);

  useEffect(
    () => () => {
      if (modelObjectUrl.current) URL.revokeObjectURL(modelObjectUrl.current);
    },
    [],
  );

  const chooseModel = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".glb")) {
      setPageError("Choose a GLB file.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_SHARED_MODEL_BYTES) {
      setPageError("GLB files must be smaller than 100 MB.");
      event.target.value = "";
      return;
    }
    if (modelObjectUrl.current) URL.revokeObjectURL(modelObjectUrl.current);
    const objectUrl = URL.createObjectURL(file);
    modelObjectUrl.current = objectUrl;
    setSelectedFile(file);
    setModelTitle(file.name.replace(/\.glb$/i, ""));
    setModelSource(objectUrl);
    setViewerError("");
    setPageError("");
    setSharedUrl("");
    event.target.value = "";
  };

  const shareModel = async () => {
    if (sharing) return;
    if (!signedIn) {
      setPageError("Sign in with the account control above to share a model.");
      return;
    }
    setSharing(true);
    setPageError("");
    setUploadProgress(0);
    try {
      let file = selectedFile;
      if (!file) {
        const response = await fetch(DEFAULT_GLB_URL);
        if (!response.ok)
          throw Error(
            `The model source returned HTTP ${response.status}. Choose the original GLB file from your device and retry.`,
          );
        const blob = await response.blob();
        file = new File([blob], "azucenas.glb", {
          type: "model/gltf-binary",
        });
      }
      const shared = await createModelShare(file, modelTitle, (progress) => {
        setUploadProgress(progress);
      });
      setSharedUrl(`${window.location.origin}/${shared.id}`);
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "The model could not be shared.",
      );
    } finally {
      setSharing(false);
    }
  };

  const copyLink = async () => {
    if (!sharedUrl) return;
    try {
      await navigator.clipboard.writeText(sharedUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setPageError("Copy was blocked. Select the link and copy it manually.");
    }
  };

  const copyPreviewLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setPreviewCopied(true);
    } catch {
      setShareFeedback("Could not copy link");
    }
  };

  const sharePreviewLink = async () => {
    if (!navigator.share) {
      await copyPreviewLink();
      return;
    }
    try {
      await navigator.share({
        title: modelTitle,
        text: "3D AR preview",
        url: window.location.href,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareFeedback("Use Copy link to share this preview");
    }
  };

  return (
    <main className="ar-model-page">
      <header className="ar-model-header">
        <a
          className="ar-model-brand"
          href="/"
          aria-label="Strange Animals home"
        >
          <img src="/media/images/logos/sa-logo.png" alt="Strange Animals" />
        </a>
        <div className="ar-model-account">
          <AccountControl />
        </div>
      </header>
      <div className="ar-model-toolbar">
        <div className="ar-model-heading">
          <a
            className="ar-model-back"
            href={
              galleryModel
                ? "/identity/my-gallery"
                : VINYL_ARTWORK_DESIGNER_PRO_PATH
            }
            aria-label={
              galleryModel
                ? "Back to My Gallery"
                : "Back to Vinyl Artwork Designer Pro"
            }
          >
            <ArrowUpLeft size={15} />
          </a>
          <div>
            <p>
              {shareId
                ? "SHARED 3D MODEL"
                : galleryModel
                  ? "MY GALLERY / 3D MODEL"
                  : "3D MODEL / AR PREVIEW"}
            </p>
            <h1>{modelTitle}</h1>
          </div>
        </div>
        {!shareId && !galleryModel && (
          <div className="ar-model-actions">
            <input
              ref={fileInput}
              className="ar-model-file-input"
              type="file"
              accept=".glb,model/gltf-binary"
              onChange={chooseModel}
            />
            <button
              className="ar-model-file-button"
              onClick={() => fileInput.current?.click()}
            >
              <Upload size={15} />
              Choose GLB
            </button>
            <button
              className="ar-model-share-button"
              disabled={!accountReady || sharing}
              onClick={() => void shareModel()}
            >
              <Share2 size={15} />
              {sharing
                ? `Uploading ${Math.round(uploadProgress * 100)}%`
                : "Share 3D model"}
            </button>
          </div>
        )}
      </div>
      <section className="ar-model-stage" aria-label="3D model preview">
        {shareId && (
          <div className="ar-model-preview-share">
            <button
              type="button"
              aria-label="Share 3D preview"
              title="Share 3D preview"
              onClick={() => void sharePreviewLink()}
            >
              <Share2 size={16} />
            </button>
            <button
              type="button"
              aria-label={previewCopied ? "Link copied" : "Copy preview link"}
              title={previewCopied ? "Copied" : "Copy preview link"}
              onClick={() => void copyPreviewLink()}
            >
              {previewCopied ? <Check size={16} /> : <Copy size={16} />}
            </button>
            <span className="ar-model-share-feedback" aria-live="polite">
              {shareFeedback}
            </span>
          </div>
        )}
        <div className="ar-model-viewer" ref={viewerHost}>
          {pageLoading && (
            <p className="ar-model-stage-message">Loading model…</p>
          )}
          {pageError && (shareId || galleryModel) && (
            <p className="ar-model-stage-message" role="alert">
              {pageError}
            </p>
          )}
          {viewerError && !shareId && !galleryModel && (
            <div className="ar-model-stage-message" role="alert">
              <p>{viewerError}</p>
              <button onClick={() => fileInput.current?.click()}>
                Choose GLB file
              </button>
            </div>
          )}
        </div>
        <span className="ar-model-stage-index">MODEL VIEWER / 01</span>
        {!pageLoading && !pageError && !viewerError && modelLoadProgress !== null && (
          <div
            className="ar-model-load-progress"
            role="progressbar"
            aria-label="Loading 3D model"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={modelLoadProgress}
          >
            <strong>{modelLoadProgress}%</strong>
            <span>Loading model…</span>
          </div>
        )}
        {viewerError && (shareId || galleryModel) && (
          <p className="ar-model-stage-message" role="alert">{viewerError}</p>
        )}
      </section>
      {!shareId && !galleryModel && (
        <section className="ar-model-share-status" aria-live="polite">
          {sharing && (
            <div className="ar-model-progress" aria-label="Upload progress">
              <span style={{ width: `${Math.round(uploadProgress * 100)}%` }} />
            </div>
          )}
          {pageError && <p role="alert">{pageError}</p>}
          {sharedUrl && (
            <div className="ar-model-share-result">
              <label>
                <span>Public preview link</span>
                <input
                  aria-label="Public preview link"
                  readOnly
                  value={sharedUrl}
                />
              </label>
              <button onClick={() => void copyLink()}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
