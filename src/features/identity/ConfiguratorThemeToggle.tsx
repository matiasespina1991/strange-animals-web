import { Moon, Sun } from "lucide-react";
import type { ConfiguratorTheme } from "./configurator-theme";

export function ConfiguratorThemeToggle({ theme, onToggle }: {
  theme: ConfiguratorTheme;
  onToggle: () => void;
}) {
  const title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return <button type="button" className="dc-theme-toggle" title={title} aria-label="Dark mode"
    aria-pressed={theme === "dark"} onClick={onToggle}>
    {theme === "dark" ? <Moon size={19} aria-hidden="true" /> : <Sun size={19} aria-hidden="true" />}
  </button>;
}
