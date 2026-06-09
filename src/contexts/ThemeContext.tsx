"use client";
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";

export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  preview: { bg: string; card: string; primary: string; accent: string };
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "berts-badness",
    name: "Bert's Badness",
    description: "Deep slate blue with warm gold & hot coral",
    preview: { bg: "#232b4a", card: "#4a5580", primary: "#e8a838", accent: "#e8553a" },
  },
  {
    id: "midnight-ember",
    name: "Midnight Ember",
    description: "Near-black with smoldering orange & crimson",
    preview: { bg: "#1a1418", card: "#3a2e34", primary: "#e87040", accent: "#c43030" },
  },
  {
    id: "arctic-steel",
    name: "Arctic Steel",
    description: "Cool grey-blue with icy cyan & silver",
    preview: { bg: "#f0f3f8", card: "#ffffff", primary: "#2880b8", accent: "#48a8c8" },
  },
  {
    id: "seahawks",
    name: "Seahawks",
    description: "College Navy with Action Green & Wolf Grey",
    preview: { bg: "#152044", card: "#2e3f6e", primary: "#69be28", accent: "#7c8a96" },
  },
  {
    id: "ny-giants",
    name: "NY Giants",
    description: "Royal blue with classic red & platinum white",
    preview: { bg: "#0b2265", card: "#1b3a8a", primary: "#a71930", accent: "#a5acaf" },
  },
  {
    id: "green-bay-packers",
    name: "Green Bay Packers",
    description: "Dark green with gold & white",
    preview: { bg: "#203731", card: "#2e4f45", primary: "#ffb612", accent: "#ffffff" },
  },
  {
    id: "indianapolis-colts",
    name: "Indianapolis Colts",
    description: "Royal blue with white & anvil grey",
    preview: { bg: "#002c5f", card: "#0a3d7a", primary: "#ffffff", accent: "#a2aaad" },
  },
  {
    id: "denver-broncos",
    name: "Denver Broncos",
    description: "Broncos Navy with orange & white",
    preview: { bg: "#0a2343", card: "#14355e", primary: "#fb4f14", accent: "#ffffff" },
  },
  {
    id: "ny-yankees",
    name: "NY Yankees",
    description: "Classic navy with white pinstripe & steel blue",
    preview: { bg: "#1a2540", card: "#2e3a55", primary: "#ffffff", accent: "#4a74c4" },
  },
];

interface ThemeContextType {
  currentTheme: string;
  setTheme: (themeId: string) => void;
  themes: ThemeDefinition[];
  renameTheme: (themeId: string, newName: string) => void;
  customNames: Record<string, string>;
}

const ThemeContext = createContext<ThemeContextType>({
  currentTheme: "berts-badness",
  setTheme: () => {},
  themes: THEMES,
  renameTheme: () => {},
  customNames: {},
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState("berts-badness");
  const [customNames, setCustomNames] = useState<Record<string, string>>({});

  // Initialize from localStorage on client only
  useEffect(() => {
    const saved = localStorage.getItem("pl-theme") || "berts-badness";
    setCurrentTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
    try {
      setCustomNames(JSON.parse(localStorage.getItem("theme-custom-names") || "{}"));
    } catch {}
  }, []);

  const applyTheme = useCallback((themeId: string) => {
    document.documentElement.setAttribute("data-theme", themeId);
  }, []);

  const setTheme = useCallback((themeId: string) => {
    setCurrentTheme(themeId);
    localStorage.setItem("pl-theme", themeId);
    applyTheme(themeId);
  }, [applyTheme]);

  const renameTheme = useCallback((themeId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCustomNames((prev) => {
      const updated = { ...prev, [themeId]: trimmed };
      localStorage.setItem("theme-custom-names", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const themedList = THEMES.map((t) => ({
    ...t,
    name: customNames[t.id] || t.name,
  }));

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, themes: themedList, renameTheme, customNames }}>
      {children}
    </ThemeContext.Provider>
  );
}
