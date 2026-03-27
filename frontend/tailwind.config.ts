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
        /* ── Base backgrounds (BloxyBet dark navy stack) ── */
        "bg-base":       "#0f1117",   // deepest page background
        "bg-sidebar":    "#161b26",   // left sidebar + right chat
        "bg-card":       "#1a1f2e",   // cards, rows, elevated surfaces
        "bg-card-hover": "#1f2640",   // hover state on rows
        "bg-input":      "#0f1117",   // input fields
        "bg-modal":      "#161b26",   // modal backgrounds

        /* Legacy aliases — kept so existing code doesn't break */
        "bg-primary":   "#0f1117",
        "bg-secondary": "#161b26",
        "bg-tertiary":  "#1a1f2e",
        "bg-hover":     "#1f2640",
        card:           "#1a1f2e",
        surface:        "#161b26",

        /* ── Accent colours ── */
        "accent-blue":   "#7DD3FC",   // PRIMARY — buttons, active states, highlights
        "accent-green":  "#00C896",   // SECONDARY — gem values, wins, success
        "accent-gold":   "#F5C542",   // jackpot pot, warnings
        "accent-red":    "#F87171",   // errors, losses
        "accent-purple": "#A78BFA",   // rare tier items

        /* Legacy accent aliases */
        "accent-cyan":       "#7DD3FC",
        "accent-cyan-dim":   "#1e6fa8",
        "accent-pink":       "#F472B6",
        primary:             "#7DD3FC",
        success:             "#00C896",
        warning:             "#F5C542",
        accent:              "#F87171",
        muted:               "#4a5568",

        /* ── Text ── */
        "text-primary":   "#ffffff",
        "text-secondary": "#a0aec0",
        "text-muted":     "#4a5568",

        /* ── Borders ── */
        "border-default": "rgba(255,255,255,0.05)",
        "border-hover":   "rgba(125,211,252,0.15)",
        "border-green":   "rgba(0,200,150,0.2)",
        border:           "rgba(255,255,255,0.05)",
      },

      fontFamily: {
        sans:    ["var(--font-inter)", "Inter", "sans-serif"],
        display: ["var(--font-rajdhani)", "Rajdhani", "sans-serif"],
        mono:    ["var(--font-jetbrains)", "JetBrains Mono", "monospace"],
      },

      borderRadius: {
        card: "12px",
        btn:  "8px",
        pill: "9999px",
        xl2:  "16px",
      },

      boxShadow: {
        card:          "0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
        "glow-blue":   "0 0 20px rgba(125,211,252,0.3)",
        "glow-green":  "0 0 16px rgba(0,200,150,0.25)",
        "glow-gold":   "0 0 24px rgba(245,197,66,0.35)",
        "glow-red":    "0 0 16px rgba(248,113,113,0.3)",
        "glow-purple": "0 0 20px rgba(167,139,250,0.3)",
        /* legacy */
        "glow-cyan":   "0 0 20px rgba(125,211,252,0.3)",
      },

      animation: {
        /* Item floating (hero section, godly items) */
        float:          "float 3s ease-in-out infinite",
        "float-slow":   "float 5s ease-in-out infinite",
        "float-fast":   "float 2s ease-in-out infinite",

        /* Glow pulses */
        "pulse-gold":   "pulseGold 2s ease-in-out infinite",
        "pulse-blue":   "pulseBlue 2s ease-in-out infinite",
        "pulse-green":  "pulseGreen 2s ease-in-out infinite",
        "pulse-soft":   "pulseSoft 4s ease-in-out infinite",

        /* Item tiers */
        rainbow:        "rainbow 3s linear infinite",
        "chroma-spin":  "chromaHue 4s linear infinite",
        "mythic-spin":  "chromaHue 5s linear infinite",

        /* UI transitions */
        shimmer:        "shimmer 1.5s infinite",
        "skeleton-move":"skeletonMove 1.2s ease-in-out infinite",
        "slide-in-right":"slideInRight 0.25s ease-out",
        "slide-in-up":  "slideInUp 0.25s ease-out",
        "slide-in-down":"slideInDown 0.2s ease-out",
        "fade-in":      "fadeIn 0.2s ease-out",
        "count-up":     "countUp 0.4s ease-out",

        /* Live feed ticker */
        ticker:         "ticker 45s linear infinite",

        /* Game animations */
        "spin-idle":    "spinIdle 30s linear infinite",
        "coin-flip":    "coinFlip 3s cubic-bezier(0.23,1,0.32,1) forwards",

        /* Background effects */
        aurora:         "aurora 14s ease-in-out infinite",
        drift:          "drift 18s ease-in-out infinite",
        "page-in":      "slideInRight 0.3s ease-out",
        "godly-float":  "float 3s ease-in-out infinite",
      },

      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%":     { transform: "translateY(-8px)" },
        },
        pulseGold: {
          "0%,100%": { boxShadow: "0 0 8px rgba(245,197,66,0.3)" },
          "50%":     { boxShadow: "0 0 28px rgba(245,197,66,0.7)" },
        },
        pulseBlue: {
          "0%,100%": { boxShadow: "0 0 8px rgba(125,211,252,0.2)" },
          "50%":     { boxShadow: "0 0 24px rgba(125,211,252,0.5)" },
        },
        pulseGreen: {
          "0%,100%": { boxShadow: "0 0 8px rgba(0,200,150,0.2)" },
          "50%":     { boxShadow: "0 0 24px rgba(0,200,150,0.5)" },
        },
        pulseSoft: {
          "0%,100%": { opacity: "0.5" },
          "50%":     { opacity: "1" },
        },
        rainbow: {
          "0%":   { filter: "hue-rotate(0deg)" },
          "100%": { filter: "hue-rotate(360deg)" },
        },
        chromaHue: {
          "0%":   { filter: "hue-rotate(0deg)" },
          "100%": { filter: "hue-rotate(360deg)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        skeletonMove: {
          "0%":   { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        slideInRight: {
          "0%":   { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)",    opacity: "1" },
        },
        slideInUp: {
          "0%":   { transform: "translateY(16px)", opacity: "0" },
          "100%": { transform: "translateY(0)",    opacity: "1" },
        },
        slideInDown: {
          "0%":   { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)",     opacity: "1" },
        },
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        countUp: {
          "0%":   { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)",   opacity: "1" },
        },
        ticker: {
          "0%":   { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        spinIdle: {
          "0%":   { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        coinFlip: {
          "0%":   { transform: "rotateY(0deg)" },
          "100%": { transform: "rotateY(1800deg)" },
        },
        aurora: {
          "0%,100%": { opacity: "0.4", transform: "scale(1) translate(0,0)" },
          "33%":     { opacity: "0.6", transform: "scale(1.04) translate(2%,-2%)" },
          "66%":     { opacity: "0.45",transform: "scale(0.98) translate(-2%,1%)" },
        },
        drift: {
          "0%,100%": { transform: "translate(0,0) rotate(0deg)" },
          "50%":     { transform: "translate(-3%,2%) rotate(2deg)" },
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
