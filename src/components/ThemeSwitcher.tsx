"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Palette } from "lucide-react";

const THEMES = [
  { id: "berts-badness", label: "Bert's Badness" },
  { id: "midnight-ember", label: "Midnight Ember" },
  { id: "arctic-steel", label: "Arctic Steel" },
  { id: "seahawks", label: "Seahawks" },
  { id: "ny-giants", label: "NY Giants" },
  { id: "green-bay-packers", label: "Green Bay Packers" },
  { id: "indianapolis-colts", label: "Indianapolis Colts" },
  { id: "denver-broncos", label: "Denver Broncos" },
  { id: "ny-yankees", label: "NY Yankees" },
];

export function ThemeSwitcher() {
  const [current, setCurrent] = useState("berts-badness");

  useEffect(() => {
    const saved = localStorage.getItem("pl-theme") || "berts-badness";
    setCurrent(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  const setTheme = (id: string) => {
    setCurrent(id);
    localStorage.setItem("pl-theme", id);
    document.documentElement.setAttribute("data-theme", id);
  };

  const currentLabel = THEMES.find((t) => t.id === current)?.label || current;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-foreground/70 hover:text-foreground">
          <Palette className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {THEMES.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={current === t.id ? "bg-accent" : ""}
          >
            {t.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
