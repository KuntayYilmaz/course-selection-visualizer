import { useState } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "course-selection-visualizer.theme";
type Theme = "light" | "dark";

export function initializeTheme() {
  let theme: Theme = window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") theme = saved;
  } catch {
    // Theme switching still works when browser storage is unavailable.
  }
  document.documentElement.dataset.theme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );
  const label =
    theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button
      className="icon-button theme-toggle"
      title={label}
      aria-label={label}
      onClick={() => {
        const next = theme === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        setTheme(next);
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // Keep the chosen appearance for this session.
        }
      }}
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
