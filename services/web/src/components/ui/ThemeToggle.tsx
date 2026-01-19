/**
 * Theme Toggle Button
 * Task 189: Dark mode toggle with persistence
 */

import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  const getIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="w-5 h-5" />;
      case 'dark':
        return <Moon className="w-5 h-5" />;
      default:
        return <Monitor className="w-5 h-5" />;
    }
  };

  const getLabel = () => {
    switch (theme) {
      case 'light':
        return 'Light mode';
      case 'dark':
        return 'Dark mode';
      default:
        return 'System theme';
    }
  };

  return (
    <button
      onClick={cycleTheme}
      className="p-2 rounded-md hover:bg-muted transition-colors"
      aria-label={`Current: ${getLabel()}. Click to change theme.`}
      title={getLabel()}
    >
      {getIcon()}
    </button>
  );
}

export function ThemeSelect() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
      <button
        onClick={() => setTheme('light')}
        className={`p-2 rounded-md transition-colors ${
          theme === 'light' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
        }`}
        aria-label="Light mode"
        aria-pressed={theme === 'light'}
      >
        <Sun className="w-4 h-4" />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`p-2 rounded-md transition-colors ${
          theme === 'dark' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
        }`}
        aria-label="Dark mode"
        aria-pressed={theme === 'dark'}
      >
        <Moon className="w-4 h-4" />
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`p-2 rounded-md transition-colors ${
          theme === 'system' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
        }`}
        aria-label="System theme"
        aria-pressed={theme === 'system'}
      >
        <Monitor className="w-4 h-4" />
      </button>
    </div>
  );
}
