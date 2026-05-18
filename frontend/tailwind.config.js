/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        fastwatch: {
          bg: "#0a0a0a",
          panel: "#1a1a1a",
          accent: "#ef4444",
          accentDark: "#991b1b",
          muted: "#808080",
        },
      },
      backgroundImage: {
        "gradient-hero": "linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(0, 0, 0, 0.5) 100%)",
      },
    },
  },
  plugins: [],
};
