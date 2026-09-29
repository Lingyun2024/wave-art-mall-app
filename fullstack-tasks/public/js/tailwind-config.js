/*
  =========================================================
  tailwind-config.js —— 沿用範本（WAVE ART MALL）的暗色主題 token
  =========================================================
  直接複用範本的配色 / 字體 / 圓角設定，讓新專案與既有站台視覺一致。
  用法：在 <head> 先載 Tailwind CDN，再載本檔。
*/
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "void-black": "#020203",
        background: "#141314",
        surface: "#141314",
        "surface-dim": "#141314",
        "surface-bright": "#3a3939",
        "surface-container-lowest": "#0e0e0e",
        "surface-container-low": "#1c1b1c",
        "surface-container": "#201f20",
        "surface-container-high": "#2a2a2a",
        "surface-container-highest": "#353435",
        "surface-variant": "#353435",
        "on-background": "#e5e2e2",
        "on-surface": "#e5e2e2",
        "on-surface-variant": "#c7c6cb",
        outline: "#919095",
        "outline-variant": "#46464b",
        "starlight-white": "#F9F9F9",
        "neon-cyan": "#00FFFF",
        "galactic-purple": "#8A2BE2",
        secondary: "#e9c349",
        "secondary-fixed": "#ffe088",
        "secondary-container": "#af8d11",
        "on-secondary": "#3c2f00",
        primary: "#c7c6cd",
        "primary-container": "#0a0b10",
        "on-primary-container": "#797980",
        tertiary: "#d2c4b9",
        error: "#ffb4ab",
        "error-container": "#93000a",
        "on-error-container": "#ffdad6",
      },
      borderRadius: { DEFAULT: "0.125rem", lg: "0.25rem", xl: "0.5rem", full: "0.75rem" },
      fontFamily: {
        body: ["Manrope", "Noto Sans TC", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
        display: ["Playfair Display", "Noto Serif TC", "serif"],
      },
    },
  },
};
