// @ts-nocheck
'use client';

import { useEffect, useState } from "react";

const themes = ["theme-anime", "theme-crystal"] as const;
type Theme = (typeof themes)[number];

const getNextTheme = (current: Theme): Theme =>
  current === "theme-anime" ? "theme-crystal" : "theme-anime";

const THEME_STORAGE_KEY = "quiz-theme";

function applyTheme(next: Theme) {
  if (typeof document === "undefined") return;
  document.body.classList.remove("theme-anime", "theme-crystal");
  document.body.classList.add(next);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("theme-crystal");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem(THEME_STORAGE_KEY) as Theme) || "theme-crystal";
    setTheme(stored);
    applyTheme(stored);
    setReady(true);
  }, []);

  const handleToggle = () => {
    const next = getNextTheme(theme);
    setTheme(next);
    applyTheme(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
  };

  if (!ready) return null;

  const isCrystal = theme === "theme-crystal";

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="fixed right-4 top-4 z-50 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-md text-sm font-semibold text-white shadow-lg hover:bg-white/20 transition-all duration-200 flex items-center gap-2"
    >
      <span role="img" aria-hidden="true">
        {isCrystal ? "💎" : "🌸"}
      </span>
      <span>{isCrystal ? "Jade" : "Anime"}</span>
    </button>
  );
}
