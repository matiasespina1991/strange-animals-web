import { useEffect, useId, useRef } from "react";

export function ConfirmationDialog({ title, description, onConfirm, onCancel }: {
  title: string;
  description: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  const root = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = root.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    cancel.current?.focus();
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return <dialog className="dc-text-color-confirmation" ref={root} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
    onCancel={(event) => { event.preventDefault(); onCancel(); }}
    onKeyDown={(event) => event.stopPropagation()}>
    <h2 id={`${id}-title`}>{title}</h2>
    <p id={`${id}-description`}>{description}</p>
    <div className="dc-confirm-actions">
      <button ref={cancel} onClick={onCancel}>Cancel</button>
      <button className="dc-confirm-apply" onClick={onConfirm}>OK</button>
    </div>
  </dialog>;
}

export function TextColorConfirmation({ side, onConfirm, onCancel }: {
  side: "A" | "B";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return <ConfirmationDialog title="Replace custom text colors?"
    description={`Some text layers have individually assigned colors. Applying this color will replace them on side ${side} only.`}
    onConfirm={onConfirm} onCancel={onCancel} />;
}
