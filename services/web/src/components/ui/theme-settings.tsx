import { Moon, Sun, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { useAccentColor, accentColors } from "@/hooks/use-accent-color";
import { cn } from "@/lib/utils";

interface ThemeSettingsProps {
  variant?: "compact" | "full";
}

export function ThemeSettings({ variant = "full" }: ThemeSettingsProps) {
  const { theme, setTheme } = useTheme();
  const { accentKey, setAccentColor } = useAccentColor();

  const isDark = theme === "dark";

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2" data-testid="theme-settings-compact">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          data-testid="button-theme-toggle-compact"
          className="rounded-full"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
        <div className="flex items-center gap-1" data-testid="accent-color-swatches-compact">
          {accentColors.map((color) => (
            <button
              key={color.key}
              onClick={() => setAccentColor(color.key)}
              className={cn(
                "w-6 h-6 rounded-full border-2 transition-all hover-elevate",
                accentKey === color.key
                  ? "border-foreground scale-110"
                  : "border-transparent"
              )}
              style={{ backgroundColor: color.hsl }}
              title={color.name}
              data-testid={`button-accent-${color.key}`}
              aria-label={`Set accent color to ${color.name}`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="theme-settings-full">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Appearance</label>
        <div className="flex items-center gap-2">
          <Button
            variant={!isDark ? "default" : "outline"}
            size="sm"
            onClick={() => setTheme("light")}
            data-testid="button-theme-light"
            className="flex items-center gap-2"
          >
            <Sun className="h-4 w-4" />
            Light
          </Button>
          <Button
            variant={isDark ? "default" : "outline"}
            size="sm"
            onClick={() => setTheme("dark")}
            data-testid="button-theme-dark"
            className="flex items-center gap-2"
          >
            <Moon className="h-4 w-4" />
            Dark
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Accent Color</label>
        <div className="flex flex-wrap gap-3" data-testid="accent-color-swatches">
          {accentColors.map((color) => (
            <button
              key={color.key}
              onClick={() => setAccentColor(color.key)}
              className={cn(
                "relative w-10 h-10 rounded-lg border-2 transition-all hover-elevate flex items-center justify-center",
                accentKey === color.key
                  ? "border-foreground ring-2 ring-offset-2 ring-offset-background ring-foreground/20"
                  : "border-transparent"
              )}
              style={{ backgroundColor: color.hsl }}
              title={color.name}
              data-testid={`button-accent-${color.key}`}
              aria-label={`Set accent color to ${color.name}`}
            >
              {accentKey === color.key && (
                <Check className="h-5 w-5 text-white drop-shadow-sm" />
              )}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground" data-testid="text-accent-color-name">
          Selected: {accentColors.find((c) => c.key === accentKey)?.name}
        </p>
      </div>
    </div>
  );
}
