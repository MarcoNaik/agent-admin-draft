import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: '#F5F1E8',
          dark: '#E8E4D4',
          darker: '#DBD7CE',
        },
        forest: {
          DEFAULT: '#1B4332',
          accent: '#2D5A45',
          light: '#3A7D5C',
          muted: 'rgba(27, 67, 50, 0.6)',
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-dm-mono)", "monospace"],
        code: ["var(--font-fira-code)", "monospace"],
      },
    },
  },
  plugins: [],
}

export default config
