/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0f172a",
        surface: "#1e293b",
        accent: "#38bdf8",
        danger: "#ef4444",
        warning: "#f59e0b",
        success: "#22c55e",
      },
      borderRadius: {
        'fieldlab': '1rem',
      },
      fontFamily: {
        data: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
