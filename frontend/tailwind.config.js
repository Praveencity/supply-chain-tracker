export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
        },
        brand: {
          light: '#38bdf8',
          DEFAULT: '#0284c7',
          dark: '#0369a1',
        }
      }
    },
  },
  plugins: [],
}
