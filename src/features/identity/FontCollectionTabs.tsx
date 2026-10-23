import { Library, Star, Type } from "lucide-react";
import type { FontPickerScope } from "./font-picker-catalog";

const collections = [
  { key: "standard", label: "Standard", Icon: Type },
  { key: "all", label: "All fonts", Icon: Library },
  { key: "favorites", label: "Favorites", Icon: Star },
] as const;

export function FontCollectionTabs({ scope, counts, loading = false, onSelect }: {
  scope: FontPickerScope;
  counts: Record<FontPickerScope, number>;
  loading?: boolean;
  onSelect: (scope: FontPickerScope) => void;
}) {
  return <div className="dc-font-scopes dc-font-collection-tabs" role="group" aria-label="Font collection">
    {collections.map(({ key, label, Icon }) => <button key={key} type="button"
      aria-pressed={scope === key} onClick={() => onSelect(key)}
      aria-label={`${label}, ${loading ? "loading" : `${counts[key]} families`}`}>
      <Icon size={16} aria-hidden="true" /><span>{label}</span>
      <small aria-hidden="true">{loading ? "…" : counts[key].toLocaleString("en-US")}</small>
    </button>)}
  </div>;
}
