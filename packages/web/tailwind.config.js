/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        chalk: '#EEF0EC', // page background
        paper: '#F8F9F6', // raised surfaces
        ink: { DEFAULT: '#1F2430', soft: '#5A6070', faint: '#B9BEB6' },
        marigold: { DEFAULT: '#F2A93B', deep: '#C9831A' }, // the one primary action per screen
        nila: '#3A4BA8', // links and focus
        leaf: '#2F8F6B', // step done
        sindoor: '#C8372D', // out of date / error
      },
      fontFamily: {
        // Ships with Windows and covers both Roman Hinglish and Devanagari.
        sans: ['"Nirmala UI"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
