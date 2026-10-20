import { useEffect, useRef } from "react";
import { getFontCategoryDisplayName } from "./font-categories";

export function FontCategoryChips({ categories, selected, onSelect, labelFor = getFontCategoryDisplayName }: {
  categories: string[]; selected: string | null; onSelect: (category: string | null) => void;
  labelFor?: (category: string) => string;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = root.current;
    const active = list?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!list || !active) return;
    const container = list.getBoundingClientRect(), item = active.getBoundingClientRect();
    if (item.left < container.left) list.scrollLeft += item.left - container.left;
    else if (item.right > container.right) list.scrollLeft += item.right - container.right;
  }, [selected]);
  return <div className="dc-category-chips" ref={root} role="group" aria-label="Font categories">
    <button aria-pressed={selected === null} onClick={() => onSelect(null)}>All</button>
    {categories.map((category) => <button key={category} aria-pressed={selected === category}
      onClick={() => onSelect(selected === category ? null : category)}>{labelFor(category)}</button>)}
  </div>;
}
