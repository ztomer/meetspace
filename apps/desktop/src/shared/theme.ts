import { useEffect } from "react";

import { useConfigValue } from "~/shared/config";

export type ThemeChoice = "system" | "light" | "dark";

const MEDIA_QUERY = "(prefers-color-scheme: dark)";

function resolve(choice: ThemeChoice): "light" | "dark" {
  if (choice === "system") {
    return window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light";
  }
  return choice;
}

function apply(resolved: "light" | "dark") {
  const root = document.documentElement;
  // shadcn/ui's @custom-variant + CSS vars key off the `.dark` class.
  root.classList.toggle("dark", resolved === "dark");
  // Also drop a data-theme attribute for future migrations off Tailwind's
  // class-based variant (e.g. css-only components, raw CSS rules).
  root.dataset.theme = resolved;
}

/**
 * Mount once at the app root. Mirrors the `theme` setting onto <html>:
 *   - "light" / "dark" -> hard-set
 *   - "system"         -> follow prefers-color-scheme, live (responds to OS changes)
 */
export function useApplyTheme() {
  const choice = (useConfigValue("theme") ?? "system") as ThemeChoice;

  useEffect(() => {
    apply(resolve(choice));

    if (choice !== "system") return;

    const mql = window.matchMedia(MEDIA_QUERY);
    const onChange = () => apply(resolve("system"));
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [choice]);
}
