/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        fastwatch: {
          bg: "#0f1117",
          panel: "#1a1d27",
          accent: "#6366f1",
          muted: "#94a3b8",
        },
      },
    },
  },
  plugins: [],
};
