import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff5f2",
          100: "#ffe5dc",
          500: "#ee4d2d",
          600: "#d84224",
          700: "#bb3419"
        }
      }
    }
  },
  plugins: []
};

export default config;
