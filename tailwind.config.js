/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        game: {
          bg: '#0f172a', // Slate 900
          panel: '#1e293b', // Slate 800
          accent: '#38bdf8', // Sky 400
          gold: '#fbbf24', // Amber 400
          danger: '#f43f5e', // Rose 500
          success: '#22c55e', // Green 500
          muted: '#64748b', // Slate 500
          text: '#f1f5f9', // Slate 100
        }
      },
      fontFamily: {
        game: ['"Rajdhani"', 'sans-serif'], // We'll add this font
        sans: ['"Inter"', 'sans-serif'],
      },
      boxShadow: {
        'neon': '0 0 5px theme("colors.game.accent"), 0 0 10px theme("colors.game.accent")',
        'neon-gold': '0 0 5px theme("colors.game.gold"), 0 0 10px theme("colors.game.gold")',
      }
    },
  },
  plugins: [],
}
