/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // --- Sistema AlimentoPuro (Material 3, tema pergamino claro) ---
        background: "#fcf9f4",
        surface: "#fcf9f4",
        "surface-bright": "#fcf9f4",
        "surface-dim": "#dcdad5",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f6f3ee",
        "surface-container": "#f0ede9",
        "surface-container-high": "#ebe8e3",
        "surface-container-highest": "#e5e2dd",
        "surface-variant": "#e5e2dd",

        "on-surface": "#1c1c19",
        "on-surface-variant": "#434843",
        "on-background": "#1c1c19",

        primary: "#061b0e",
        "primary-container": "#1b3022",
        "primary-fixed": "#d0e9d4",
        "primary-fixed-dim": "#b4cdb8",
        "on-primary": "#ffffff",
        "on-primary-container": "#819986",

        secondary: "#7c5730",
        "secondary-container": "#fdcb9b",
        "secondary-fixed": "#ffdcbd",
        "secondary-fixed-dim": "#eebd8e",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#79542d",

        tertiary: "#031c01",
        "tertiary-container": "#17320f",
        "tertiary-fixed": "#caecb9",
        "tertiary-fixed-dim": "#aed09f",
        "on-tertiary": "#ffffff",
        "on-tertiary-fixed-variant": "#314e28",

        outline: "#737973",
        "outline-variant": "#c3c8c1",
        "surface-tint": "#4d6453",

        // --- Acentos semánticos (frescura / podredumbre) sobre tema claro ---
        fresh: {
          DEFAULT: "#2e7d46",
          glow: "#3f9d5c",
          container: "#d0e9d4",
          on: "#0b2013",
        },
        rotten: {
          DEFAULT: "#ba1a1a",
          glow: "#d4332f",
          container: "#ffdad6",
          on: "#410002",
        },
      },
      fontFamily: {
        sans: ["Hanken Grotesk", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["Newsreader", "ui-serif", "Georgia", "serif"],
      },
      letterSpacing: {
        tightest: "-0.02em",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        pop: {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "70%": { transform: "scale(1.1)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.5s ease-out both",
        "fade-in": "fade-in 0.4s ease-out both",
        pop: "pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both",
      },
    },
  },
  plugins: [],
};
