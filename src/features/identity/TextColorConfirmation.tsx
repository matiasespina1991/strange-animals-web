import { useEffect, useId, useRef } from "react";

export function TextColorConfirmation({ color, onConfirm, onCancel }: {
  color: string; onConfirm: () => void; onCancel: () => void;
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
    <h2 id={`${id}-title`}>Replace custom text colors?</h2>
    <p id={`${id}-description`}>Some text layers have individually assigned colors. Applying this color will replace them on both sides A and B.</p>
    <div className="dc-confirm-color"><span style={{ backgroundColor: color }} aria-hidden="true" />{color.toUpperCase()}</div>
    <div className="dc-confirm-actions">
      <button ref={cancel} onClick={onCancel}>Cancel</button>
      <button className="dc-confirm-apply" onClick={onConfirm}>Apply to all text</button>
    </div>
  </dialog>;
}
