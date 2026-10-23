import { useRef } from "react";
import { ImagePlus, X } from "lucide-react";
import { TypographyValueControl } from "./TypographyValueControl";

export function TextSurfaceControl({
  layerId,
  image,
  opacity = 1,
  scale = 100,
  onChange,
  onCommit,
  onError,
}: {
  layerId: string;
  image?: string;
  opacity?: number;
  scale?: number;
  onChange: (
    patch: { textTexture?: string; textTextureOpacity?: number },
    group?: string,
  ) => void;
  onCommit: () => void;
  onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const upload = async (file?: File) => {
    if (!file) return;
    try {
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 5 * 1024 * 1024
      )
        throw Error("Usá PNG, JPEG o WebP de hasta 5 MB.");
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const loaded = new Image();
      await new Promise<void>((resolve, reject) => {
        loaded.onload = () => resolve();
        loaded.onerror = reject;
        loaded.src = data;
      });
      onCommit();
      onChange({
        textTexture: data,
        textTextureOpacity: opacity,
        textTextureScale: scale,
      });
      onCommit();
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "No se pudo abrir la imagen.",
      );
    }
  };
  const remove = () => {
    onCommit();
    onChange({
      textTexture: undefined,
      textTextureOpacity: undefined,
      textTextureScale: undefined,
    });
    onCommit();
  };

  return (
    <div className="dc-text-surface">
      <span>Text surface</span>
      <div className="dc-text-surface-actions">
        {image && (
          <img src={image} alt="" className="dc-text-surface-preview" />
        )}
        <button
          type="button"
          className="dc-text-surface-upload"
          onClick={() => input.current?.click()}
        >
          <ImagePlus size={15} />
          {image ? "Replace image" : "Choose image"}
        </button>
        {image && (
          <button
            type="button"
            className="dc-text-surface-remove"
            aria-label="Remove text surface image"
            title="Remove image"
            onClick={remove}
          >
            <X size={14} />
          </button>
        )}
      </div>
      <input
        hidden
        type="file"
        ref={input}
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => {
          void upload(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      {image && (
        <TypographyValueControl
          label="Texture scale"
          unit="%"
          value={scale}
          min={25}
          max={400}
          step={1}
          onChange={(value) =>
            onChange(
              { textTextureScale: value },
              `text-surface-scale-${layerId}`,
            )
          }
          onCommit={onCommit}
        />
      )}
      {image && (
        <TypographyValueControl
          label="Texture opacity"
          unit="%"
          value={Math.round(opacity * 100)}
          min={0}
          max={100}
          step={1}
          onChange={(value) =>
            onChange(
              { textTextureOpacity: value / 100 },
              `text-surface-opacity-${layerId}`,
            )
          }
          onCommit={onCommit}
        />
      )}
    </div>
  );
}
