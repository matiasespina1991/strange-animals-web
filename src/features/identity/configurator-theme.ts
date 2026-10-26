export type ConfiguratorTheme = "light" | "dark";
export const CONFIGURATOR_THEME_KEY = "sa-design-configurator-theme";

export function readConfiguratorTheme(storage?: Pick<Storage, "getItem">): ConfiguratorTheme {
  try {
    const source = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
    return source?.getItem(CONFIGURATOR_THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function saveConfiguratorTheme(theme: ConfiguratorTheme, storage?: Pick<Storage, "setItem">) {
  try {
    const target = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
    target?.setItem(CONFIGURATOR_THEME_KEY, theme);
  } catch {
    // The current session still works when browser storage is blocked or full.
  }
}
