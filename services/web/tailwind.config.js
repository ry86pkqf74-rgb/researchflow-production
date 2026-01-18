/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: ".5625rem", /* 9px */
        md: ".375rem", /* 6px */
        sm: ".1875rem", /* 3px */
        // Design System border radius
        'ds-sm': '4px',
        'ds-md': '8px',
        'ds-lg': '12px',
      },
      fontSize: {
        // Design System typography scale (ds- prefixed to avoid conflicts)
        'ds-display': ['48px', { lineHeight: '56px', fontWeight: '700' }],
        'ds-h1': ['32px', { lineHeight: '40px', fontWeight: '600' }],
        'ds-h2': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'ds-h3': ['20px', { lineHeight: '28px', fontWeight: '500' }],
        'ds-body': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'ds-caption': ['14px', { lineHeight: '20px', fontWeight: '400' }],
      },
      spacing: {
        // Design System spacing scale
        'ds-xs': '4px',
        'ds-sm': '8px',
        'ds-md': '16px',
        'ds-lg': '24px',
        'ds-xl': '32px',
        'ds-2xl': '48px',
      },
      boxShadow: {
        // Design System shadows
        'ds-sm': '0 1px 2px rgba(0,0,0,0.05)',
        'ds-md': '0 4px 6px rgba(0,0,0,0.1)',
        'ds-lg': '0 10px 15px rgba(0,0,0,0.1)',
      },
      colors: {
        // Governance colors
        'governance-red': '#dc2626',
        'governance-yellow': '#fbbf24',
        'governance-green': '#10b981',
        'governance-blue': '#3b82f6',
        // Flat / base colors (regular buttons)
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
          border: "hsl(var(--card-border) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
          border: "hsl(var(--popover-border) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          border: "var(--primary-border)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
          border: "var(--secondary-border)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
          border: "var(--muted-border)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
          border: "var(--accent-border)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
          border: "var(--destructive-border)",
        },
        ring: "hsl(var(--ring) / <alpha-value>)",
        chart: {
          "1": "hsl(var(--chart-1) / <alpha-value>)",
          "2": "hsl(var(--chart-2) / <alpha-value>)",
          "3": "hsl(var(--chart-3) / <alpha-value>)",
          "4": "hsl(var(--chart-4) / <alpha-value>)",
          "5": "hsl(var(--chart-5) / <alpha-value>)",
        },
        sidebar: {
          ring: "hsl(var(--sidebar-ring) / <alpha-value>)",
          DEFAULT: "hsl(var(--sidebar) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
          border: "hsl(var(--sidebar-border) / <alpha-value>)",
        },
        "sidebar-primary": {
          DEFAULT: "hsl(var(--sidebar-primary) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-primary-foreground) / <alpha-value>)",
          border: "var(--sidebar-primary-border)",
        },
        "sidebar-accent": {
          DEFAULT: "hsl(var(--sidebar-accent) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-accent-foreground) / <alpha-value>)",
          border: "var(--sidebar-accent-border)"
        },
        status: {
          online: "rgb(34 197 94)",
          away: "rgb(245 158 11)",
          busy: "rgb(239 68 68)",
          offline: "rgb(156 163 175)",
        },
        // ROS (Research Operating System) color palette - vibrant accent colors
        ros: {
          primary: "hsl(var(--ros-primary) / <alpha-value>)",
          success: "hsl(var(--ros-success) / <alpha-value>)",
          workflow: "hsl(var(--ros-workflow) / <alpha-value>)",
          alert: "hsl(var(--ros-alert) / <alpha-value>)",
          neutral: "hsl(var(--ros-neutral) / <alpha-value>)",
        },
        
        // Design System - Primary Colors (Vibrant ROS Palette)
        'ocean-blue': {
          DEFAULT: '#2B8DD6',
          hover: '#2477B8',
          active: '#1E639A',
        },
        'success-green': '#22C55E',
        'creative-purple': '#8B5CF6',
        
        // Design System - Secondary Colors
        'warm-coral': '#EF4444',
        'golden-amber': '#F97316',
        
        // Design System - Neutral Colors
        'dark-slate': '#2D3748',
        'light-gray': '#F7FAFC',
        
        // Design System - Interaction Colors
        'secondary-hover': '#DBEAFE',
        'secondary-active': '#BFDBFE',
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
      zIndex: {
        'safety-banner': '9999',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
}
