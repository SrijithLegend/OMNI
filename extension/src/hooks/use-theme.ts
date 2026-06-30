/**
 * useTheme — Hook for accessing and controlling the Omni theme system.
 *
 * Provides: current mode, system preference, toggle, set, and CSS variable injection.
 */

import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "dark" | "light" | "system";

interface ThemeState {
  mode: ThemeMode;
  resolved: "dark" | "light";
  isDark: boolean;
  isLight: boolean;
  isSystem: boolean;
}

const STORAGE_KEY = "omni_theme_mode";

function getSystemTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode;
    if (stored && ["dark", "light", "system"].includes(stored)) return stored;
  } catch (_) {}
  return "system";
}

function setStoredTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch (_) {}
}

function applyTheme(mode: ThemeMode): void {
  const resolved = mode === "system" ? getSystemTheme() : mode;
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.classList.remove("dark", "light");
  root.classList.add(resolved);
}

export function useTheme(): ThemeState & {
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
} {
  const [mode, setModeState] = useState<ThemeMode>(getStoredTheme);
  const [resolved, setResolved] = useState<"dark" | "light">(
    getStoredTheme() === "system" ? getSystemTheme() : getStoredTheme() as "dark" | "light"
  );

  useEffect(() => {
    applyTheme(mode);
    setResolved(mode === "system" ? getSystemTheme() : mode);
  }, [mode]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (mode === "system") {
        const r = mq.matches ? "dark" : "light";
        setResolved(r);
        applyTheme("system");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    setStoredTheme(newMode);
    applyTheme(newMode);
    setResolved(newMode === "system" ? getSystemTheme() : newMode);
  }, []);

  const toggle = useCallback(() => {
    const next = resolved === "dark" ? "light" : "dark";
    setMode(next);
  }, [resolved, setMode]);

  return {
    mode,
    resolved,
    isDark: resolved === "dark",
    isLight: resolved === "light",
    isSystem: mode === "system",
    setMode,
    toggle,
  };
}
