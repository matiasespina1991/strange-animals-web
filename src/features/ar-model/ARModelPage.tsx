import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ArrowUpLeft, Check, Copy, Share2, Upload } from "lucide-react";
import { AccountControl } from "@/features/identity/AccountControl";
import { accountAuth } from "@/features/identity/account-auth";
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
      void customElements.whenDefined("model-viewer").then(resolve, reject);
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

export default function ARModelPage({ shareId }: ARModelPageProperties) {
  const viewerHost = useRef<HTMLDivElement>(null);
  const modelObjectUrl = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [modelSource, setModelSource] = useState(
    shareId ? "" : DEFAULT_GLB_URL,
  );
  const [modelTitle, setModelTitle] = useState("Azucenas");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewerError, setViewerError] = useState("");
  const [pageError, setPageError] = useState("");
  const [pageLoading, setPageLoading] = useState(Boolean(shareId));
  const [accountReady, setAccountReady] = useState(false);
  const [signedIn, setSignedIn] = useState(Boolean(accountAuth.currentUser));
  const [sharing, setSharing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sharedUrl, setSharedUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.title = shareId
      ? "Shared 3D model | Strange Animals"
      : "3D AR preview | Strange Animals";
    return onAuthStateChanged(accountAuth, (user) => {
      setSignedIn(Boolean(user));
      setAccountReady(true);
    });
  }, [shareId]);

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
    const host = viewerHost.current;
    if (!host || !modelSource) return;
    let active = true;
    setViewerError("");
    void ensureModelViewer()
      .then(() => {
        if (!active) return;
        const viewer = document.createElement("model-viewer");
        viewer.setAttribute("src", modelSource);
        if (/\b(?:sleeve|vinyl|vinilo|vinilos)\b/i.test(modelTitle)) {
          viewer.setAttribute("scale", "0.1 0.1 0.1");
        }
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
        viewer.addEventListener("error", () => {
          if (active)
            setViewerError(
              "The model URL could not be loaded. Choose the original GLB file to preview and share it.",
            );
        });
        const arButton = document.createElement("button");
        arButton.slot = "ar-button";
        arButton.className = "ar-model-ar-button";
        arButton.textContent = "Ver en tu espacio";
        viewer.append(arButton);
        host.replaceChildren(viewer);
      })
      .catch(() => {
        if (active) setViewerError("The 3D viewer could not be loaded.");
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

  return (
    <main className="ar-model-page">
      <header className="ar-model-header">
        <a
          className="ar-model-brand"
          href="/"
          aria-label="Strange Animals home"
        >
          STRANGE ANIMALS
        </a>
        <div className="ar-model-account">
          <AccountControl />
        </div>
      </header>
      <div className="ar-model-toolbar">
        <div className="ar-model-heading">
          <a className="ar-model-back" href="/" aria-label="Back to home">
            <ArrowUpLeft size={15} />
          </a>
          <div>
            <p>{shareId ? "SHARED 3D MODEL" : "3D MODEL / AR PREVIEW"}</p>
            <h1>{modelTitle}</h1>
          </div>
        </div>
        {!shareId && (
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
        <div className="ar-model-viewer" ref={viewerHost}>
          {pageLoading && (
            <p className="ar-model-stage-message">Loading model…</p>
          )}
          {pageError && shareId && (
            <p className="ar-model-stage-message" role="alert">
              {pageError}
            </p>
          )}
          {viewerError && !shareId && (
            <div className="ar-model-stage-message" role="alert">
              <p>{viewerError}</p>
              <button onClick={() => fileInput.current?.click()}>
                Choose GLB file
              </button>
            </div>
          )}
        </div>
        <span className="ar-model-stage-index">MODEL VIEWER / 01</span>
      </section>
      {!shareId && (
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
