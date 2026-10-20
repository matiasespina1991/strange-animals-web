import { useRef } from "react";
import { ImagePlus, X } from "lucide-react";

export function SleeveImageControl({ image, onChange, onError }: {
  image?: string; onChange: (image?: string) => void; onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const upload = async (file?: File) => {
    if (!file) return;
    try {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)
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
      onChange(data);
    } catch (error) {
      onError(error instanceof Error ? error.message : "No se pudo abrir la imagen.");
    }
  };
  return <>
    <button className="dc-sleeve-image" aria-label={image ? "Replace sleeve image" : "Upload sleeve image"}
      title={image ? "Replace sleeve image" : "Upload sleeve image"} onClick={() => input.current?.click()}>
      {image ? <img src={image} alt="" /> : <ImagePlus size={15} />}
    </button>
    {image && <button className="dc-sleeve-image-remove" aria-label="Remove sleeve image" title="Remove sleeve image" onClick={() => onChange(undefined)}><X size={12} /></button>}
    <input hidden type="file" ref={input} accept="image/png,image/jpeg,image/webp"
      onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ""; }} />
  </>;
}
