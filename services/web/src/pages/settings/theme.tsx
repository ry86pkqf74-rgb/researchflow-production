/**
 * Theme Settings Page
 * Task 163: Custom theme editor
 */

import { useState, useEffect } from 'react';
import { Palette, RotateCcw, Check } from 'lucide-react';
import { ThemeVars, DEFAULT_THEME_VARS, THEME_PRESETS } from '@/theme/tokens';
import { applyThemeVars, saveThemeVars, loadThemeVars, resetTheme } from '@/theme/applyTheme';

export default function ThemeSettingsPage() {
  const [vars, setVars] = useState<ThemeVars>(loadThemeVars);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  useEffect(() => {
    applyThemeVars(vars);
  }, [vars]);

  const handleColorChange = (key: keyof ThemeVars, value: string) => {
    const newVars = { ...vars, [key]: value };
    setVars(newVars);
    setActivePreset(null);
  };

  const handleSave = () => {
    saveThemeVars(vars);
    // Show success toast
  };

  const handlePresetSelect = (presetName: string) => {
    const preset = THEME_PRESETS[presetName];
    if (preset) {
      setVars(preset);
      setActivePreset(presetName);
    }
  };

  const handleReset = () => {
    resetTheme();
    setVars(DEFAULT_THEME_VARS);
    setActivePreset('default');
  };

  const colorLabels: Record<keyof ThemeVars, string> = {
    '--ros-primary': 'Primary',
    '--ros-primary-foreground': 'Primary Text',
    '--ros-secondary': 'Secondary',
    '--ros-secondary-foreground': 'Secondary Text',
    '--ros-success': 'Success',
    '--ros-success-foreground': 'Success Text',
    '--ros-warning': 'Warning',
    '--ros-warning-foreground': 'Warning Text',
    '--ros-alert': 'Alert/Error',
    '--ros-alert-foreground': 'Alert Text',
    '--ros-workflow': 'Workflow',
    '--ros-workflow-foreground': 'Workflow Text',
    '--ros-accent': 'Accent',
    '--ros-accent-foreground': 'Accent Text',
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Palette className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Theme Settings</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-muted"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <Check className="w-4 h-4" />
            Save Theme
          </button>
        </div>
      </div>

      {/* Presets */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Presets</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(THEME_PRESETS).map(([name, preset]) => (
            <button
              key={name}
              onClick={() => handlePresetSelect(name)}
              className={`p-3 rounded-lg border-2 transition-colors ${
                activePreset === name
                  ? 'border-primary bg-primary/5'
                  : 'border-transparent bg-muted hover:border-muted-foreground/20'
              }`}
            >
              <div className="flex gap-1 mb-2">
                {[preset['--ros-primary'], preset['--ros-success'], preset['--ros-workflow']].map(
                  (color, i) => (
                    <div
                      key={i}
                      className="w-6 h-6 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  )
                )}
              </div>
              <span className="text-sm font-medium capitalize">{name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Color Editor */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Custom Colors</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(Object.entries(colorLabels) as [keyof ThemeVars, string][]).map(([key, label]) => (
            <div key={key} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <input
                type="color"
                value={vars[key]}
                onChange={(e) => handleColorChange(key, e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border-0"
              />
              <div className="flex-1">
                <label className="text-sm font-medium">{label}</label>
                <p className="text-xs text-muted-foreground font-mono">{vars[key]}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Preview */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Preview</h2>
        <div className="p-6 rounded-lg border bg-card space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              className="px-4 py-2 rounded-md text-sm font-medium"
              style={{
                backgroundColor: vars['--ros-primary'],
                color: vars['--ros-primary-foreground'],
              }}
            >
              Primary Button
            </button>
            <button
              className="px-4 py-2 rounded-md text-sm font-medium"
              style={{
                backgroundColor: vars['--ros-secondary'],
                color: vars['--ros-secondary-foreground'],
              }}
            >
              Secondary
            </button>
            <button
              className="px-4 py-2 rounded-md text-sm font-medium"
              style={{
                backgroundColor: vars['--ros-success'],
                color: vars['--ros-success-foreground'],
              }}
            >
              Success
            </button>
            <button
              className="px-4 py-2 rounded-md text-sm font-medium"
              style={{
                backgroundColor: vars['--ros-alert'],
                color: vars['--ros-alert-foreground'],
              }}
            >
              Alert
            </button>
          </div>
          <div className="flex gap-2">
            <span
              className="px-2 py-1 rounded text-xs font-medium"
              style={{
                backgroundColor: vars['--ros-workflow'],
                color: vars['--ros-workflow-foreground'],
              }}
            >
              Workflow Badge
            </span>
            <span
              className="px-2 py-1 rounded text-xs font-medium"
              style={{
                backgroundColor: vars['--ros-accent'],
                color: vars['--ros-accent-foreground'],
              }}
            >
              Accent Badge
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
