import React from 'react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Moon, Sun, Palette, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeSelectorProps {
  themeMode: 'light' | 'dark';
  setThemeMode: (mode: 'light' | 'dark') => void;
  themeColor: 'blue' | 'emerald' | 'violet' | 'rose' | 'amber';
  setThemeColor: (color: 'blue' | 'emerald' | 'violet' | 'rose' | 'amber') => void;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  themeMode,
  setThemeMode,
  themeColor,
  setThemeColor,
}) => {
  const colors: Array<{ id: typeof themeColor; name: string; class: string }> = [
    { id: 'blue', name: 'Default Blue', class: 'bg-blue-500' },
    { id: 'emerald', name: 'Emerald Green', class: 'bg-emerald-500' },
    { id: 'violet', name: 'Violet Sunset', class: 'bg-violet-500' },
    { id: 'rose', name: 'Rose Velvet', class: 'bg-rose-500' },
    { id: 'amber', name: 'Amber Gold', class: 'bg-amber-500' },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button 
          id="theme-selector-trigger"
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-muted transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
          title="Select theme and mode"
        >
          <Palette size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-card border border-border-strong/50 shadow-xl rounded-xl p-2 z-50">
        <DropdownMenuLabel className="text-xs font-bold text-content-muted uppercase tracking-wider px-2 py-1.5">
          Theme Color
        </DropdownMenuLabel>
        
        {colors.map((color) => (
          <DropdownMenuItem 
            key={color.id}
            id={`theme-color-${color.id}`}
            onClick={() => setThemeColor(color.id)}
            className="flex items-center justify-between px-2 py-1.5 cursor-pointer text-xs rounded-md"
          >
            <div className="flex items-center gap-2">
              <span className={cn("w-3.5 h-3.5 rounded-full border border-black/10 dark:border-white/10 shadow-xs", color.class)} />
              <span className="font-medium text-content-primary">{color.name}</span>
            </div>
            {themeColor === color.id && (
              <Check size={14} className="text-brand-primary" />
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator className="bg-border-subtle my-1" />
        
        <DropdownMenuLabel className="text-xs font-bold text-content-muted uppercase tracking-wider px-2 py-1.5">
          Theme Mode
        </DropdownMenuLabel>
        
        <DropdownMenuItem 
          id="theme-mode-light"
          onClick={() => setThemeMode('light')}
          className="flex items-center justify-between px-2 py-1.5 cursor-pointer text-xs rounded-md"
        >
          <div className="flex items-center gap-2 text-content-primary">
            <Sun size={14} className="text-amber-500" />
            <span className="font-medium">Light Mode</span>
          </div>
          {themeMode === 'light' && (
            <Check size={14} className="text-brand-primary" />
          )}
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          id="theme-mode-dark"
          onClick={() => setThemeMode('dark')}
          className="flex items-center justify-between px-2 py-1.5 cursor-pointer text-xs rounded-md"
        >
          <div className="flex items-center gap-2 text-content-primary">
            <Moon size={14} className="text-indigo-400" />
            <span className="font-medium">Dark Mode</span>
          </div>
          {themeMode === 'dark' && (
            <Check size={14} className="text-brand-primary" />
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
