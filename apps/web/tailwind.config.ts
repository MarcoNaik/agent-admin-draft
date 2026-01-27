import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    "font-dm",
    "font-ibm",
    "font-roboto",
    "font-source",
    "font-overpass",
    "font-redhat",
    "font-fira",
  ],
  theme: {
    extend: {
      fontFamily: {
        "space": ["var(--font-space-mono)", "monospace"],
        "share": ["var(--font-share-tech)", "monospace"],
        "azeret": ["var(--font-azeret)", "monospace"],
        "dm": ["var(--font-dm-mono)", "monospace"],
        "major": ["var(--font-major-mono)", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.6s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
}

export default config
