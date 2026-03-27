import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./contexts/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /** Bloxy-style charcoal stack */
        "bg-primary": "#111217",
        "bg-secondary": "#151a21",
        "bg-tertiary": "#1e1f23",
        "bg-hover": "#25262b",
        /** Brand blue (replaces former green/cyan accents across the app) */
        "accent-cyan": "#3b82f6",
        "accent-cyan-dim": "#1e40af",
        "accent-purple": "#2563eb",
        "accent-blue": "#60a5fa",
        "accent-gold": "#f0d090",
        "accent-red": "#f87171",
        "accent-green": "#3b82f6",
        "accent-pink": "#f472b6",
        "text-primary": "#f4f7fb",
        "text-secondary": "#9ca3af",
        "text-muted": "#6b7280",
        "border-default": "rgba(255, 255, 255, 0.06)",
        "border-hover": "rgba(59, 130, 246, 0.35)",
        /** Legacy aliases used across app */
        border: "rgba(255, 255, 255, 0.08)",
        card: "#1e1f23",
        primary: "#3b82f6",
        muted: "#6b7280",
        surface: "#151a21",
        accent: "#f87171",
        success: "#3b82f6",
        warning: "#f0d090",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
        display: ["var(--font-rajdhani)", "Rajdhani", "sans-serif"],
        mono: ["var(--font-jetbrains)", "JetBrains Mono", "monospace"],
      },
      borderRadius: {
        card: "16px",
        btn: "10px",
        pill: "9999px",
      },
      boxShadow: {
        card: "0 4px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
        "glow-purple": "0 0 24px rgba(59,130,246,0.35)",
        "glow-cyan": "0 0 28px rgba(59,130,246,0.4), 0 0 60px rgba(59,130,246,0.15)",
        "glow-gold": "0 0 24px rgba(240,208,144,0.35)",
        "glow-green": "0 0 20px rgba(59,130,246,0.35)",
        "glow-red": "0 0 20px rgba(248,113,113,0.35)",
        "glow-blue": "0 0 22px rgba(96,165,250,0.35)",
      },
      animation: {
        float: "float 3s ease-in-out infinite",
        "pulse-gold": "pulseGold 2s ease-in-out infinite",
        rainbow: "rainbow 3s linear infinite",
        shimmer: "shimmer 1.5s infinite",
        "slide-in-right": "slideInRight 0.3s ease-out",
        "count-up": "countUp 0.4s ease-out",
        ticker: "ticker 45s linear infinite",
        "godly-float": "float 3s ease-in-out infinite",
        "chroma-spin": "rainbow 3s linear infinite",
        "page-in": "slideInRight 0.3s ease-out",
        aurora: "aurora 14s ease-in-out infinite",
        drift: "drift 18s ease-in-out infinite",
        "pulse-soft": "pulseSoft 4s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        pulseGold: {
          "0%, 100%": { boxShadow: "0 0 12px rgba(245,197,66,0.4)" },
          "50%": { boxShadow: "0 0 32px rgba(245,197,66,0.8)" },
        },
        rainbow: {
          "0%": { filter: "hue-rotate(0deg)" },
          "100%": { filter: "hue-rotate(360deg)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        slideInRight: {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        countUp: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        aurora: {
          "0%, 100%": { opacity: "0.45", transform: "scale(1) translate(0,0)" },
          "33%": { opacity: "0.65", transform: "scale(1.05) translate(2%, -2%)" },
          "66%": { opacity: "0.5", transform: "scale(0.98) translate(-2%, 1%)" },
        },
        drift: {
          "0%, 100%": { transform: "translate(0, 0) rotate(0deg)" },
          "50%": { transform: "translate(-3%, 2%) rotate(2deg)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
      },
      minHeight: {
        screen: "100dvh",
      },
    },
  },
  plugins: [],
};

export default config;
