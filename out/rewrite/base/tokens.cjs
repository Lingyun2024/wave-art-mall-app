/*
  =========================================================
  tokens.cjs —— 設計 token 唯一來源（H1 凍結）
  =========================================================
  依 ADR-0003：本檔是全站顏色／字體／圓角／間距的唯一事實來源。
  修改本檔後必須重跑 `npm run build:css` 重新編譯 base.css，
  並讓 `build` 門禁的 hash 檢查通過。

  歷史：本 token 集直接承繼 js/tailwind-config.js（2026-09-12 前
  已由 27 頁內嵌 config 交叉驗證一致），值未做任何更動，只收斂來源。
*/

module.exports = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // 品牌主色：暗夜黑、金色、青色霓光
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
        "secondary-fixed-dim": "#e9c349",
        "secondary-container": "#af8d11",
        "on-secondary": "#3c2f00",
        "on-secondary-container": "#342800",
        "on-secondary-fixed": "#241a00",
        "on-secondary-fixed-variant": "#574500",
        primary: "#c7c6cd",
        "primary-container": "#0a0b10",
        "primary-fixed": "#e3e1e9",
        "primary-fixed-dim": "#c7c6cd",
        "on-primary": "#2f3036",
        "on-primary-container": "#797980",
        "on-primary-fixed": "#1a1b21",
        "on-primary-fixed-variant": "#46464c",
        tertiary: "#d2c4b9",
        "tertiary-fixed": "#efe0d5",
        "tertiary-fixed-dim": "#d2c4b9",
        "tertiary-container": "#100a05",
        "on-tertiary": "#372f27",
        "on-tertiary-container": "#83786f",
        "on-tertiary-fixed": "#211a14",
        "on-tertiary-fixed-variant": "#4e453d",
        error: "#ffb4ab",
        "error-container": "#93000a",
        "on-error": "#690005",
        "on-error-container": "#ffdad6",
        "inverse-surface": "#e5e2e2",
        "inverse-on-surface": "#313030",
        "inverse-primary": "#5e5e64",
        "surface-tint": "#c7c6cd",
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        full: "0.75rem",
      },
      spacing: {
        "margin-desktop": "80px",
        gutter: "24px",
        "margin-mobile": "20px",
        "container-max": "1440px",
        unit: "8px",
      },
      fontFamily: {
        "body-md": ["Manrope"],
        "label-sm": ["JetBrains Mono"],
        "headline-lg-mobile": ["Playfair Display"],
        "headline-xl": ["Playfair Display"],
        "headline-lg": ["Playfair Display"],
      },
      fontSize: {
        "body-md": ["16px", { lineHeight: "1.6", fontWeight: "400" }],
        "label-sm": ["12px", { lineHeight: "1.0", letterSpacing: "0.1em", fontWeight: "500" }],
        "headline-lg-mobile": ["28px", { lineHeight: "1.3", fontWeight: "600" }],
        "headline-xl": ["48px", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg": ["32px", { lineHeight: "1.3", fontWeight: "600" }],
      },
    },
  },
};
