import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        stone: {
          cream: "#F8F6F2",
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
        sans: ["DM Sans", "sans-serif"],
        display: ["Fraunces", "serif"],
        mono: ["JetBrains Mono", "monospace"],
        input: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
