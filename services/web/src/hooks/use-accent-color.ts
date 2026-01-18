import { useState, useEffect, useCallback } from "react";

export type AccentColorKey = 
  | "academic-blue"
  | "research-green"
  | "workflow-purple"
  | "medical-teal"
  | "classic-gray";

export interface AccentColor {
  key: AccentColorKey;
  name: string;
  hsl: string;
  cssValue: string;
}

export const accentColors: AccentColor[] = [
  {
    key: "academic-blue",
    name: "Academic Blue",
    hsl: "hsl(221, 83%, 53%)",
    cssValue: "221 83% 53%",
  },
  {
    key: "research-green",
    name: "Research Green",
    hsl: "hsl(161, 79%, 40%)",
    cssValue: "161 79% 40%",
  },
  {
    key: "workflow-purple",
    name: "Workflow Purple",
    hsl: "hsl(263, 55%, 52%)",
    cssValue: "263 55% 52%",
  },
  {
    key: "medical-teal",
    name: "Medical Teal",
    hsl: "hsl(180, 60%, 45%)",
    cssValue: "180 60% 45%",
  },
  {
    key: "classic-gray",
    name: "Classic Gray",
    hsl: "hsl(220, 14%, 46%)",
    cssValue: "220 14% 46%",
  },
];

const STORAGE_KEY = "ros-accent-color";
const DEFAULT_ACCENT: AccentColorKey = "academic-blue";

function getAccentByKey(key: AccentColorKey): AccentColor {
  return accentColors.find((c) => c.key === key) || accentColors[0];
}

function applyAccentColor(accent: AccentColor) {
  const root = document.documentElement;
  root.style.setProperty("--primary", accent.cssValue);
  root.style.setProperty("--ring", accent.cssValue);
}

export function useAccentColor() {
  const [accentKey, setAccentKey] = useState<AccentColorKey>(() => {
    if (typeof window === "undefined") return DEFAULT_ACCENT;
    const stored = localStorage.getItem(STORAGE_KEY) as AccentColorKey | null;
    return stored && accentColors.some((c) => c.key === stored)
      ? stored
      : DEFAULT_ACCENT;
  });

  const accent = getAccentByKey(accentKey);

  useEffect(() => {
    applyAccentColor(accent);
  }, [accent]);

  const setAccentColor = useCallback((key: AccentColorKey) => {
    localStorage.setItem(STORAGE_KEY, key);
    setAccentKey(key);
  }, []);

  return {
    accent,
    accentKey,
    accentColors,
    setAccentColor,
  };
}
