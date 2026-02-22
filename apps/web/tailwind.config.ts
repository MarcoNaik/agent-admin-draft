import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        stone: {
          base: "#F8F6F2",
          deep: "#F1EDE7",
          card: "#EEEBE5",
        },
        ocean: {
          DEFAULT: "#1B4F72",
          light: "#2C7DA0",
        },
        amber: {
          DEFAULT: "#D4A853",
          light: "#E8C468",
        },
        charcoal: {
          DEFAULT: "#2D2A26",
          heading: "#1A1815",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      animation: {
        "shimmer": "shimmer 3s linear infinite",
        "fade-cycle": "fadeCycle 5s ease-in-out infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        fadeCycle: {
          "0%, 100%": { opacity: "0" },
          "15%, 85%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
}

export default config
