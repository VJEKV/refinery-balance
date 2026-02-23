/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#050a18',
          card: '#0c1529',
          'card-hover': '#111d35',
          sidebar: '#080e20',
          border: '#1e293b',
          text: '#e2e8f0',
          muted: '#94a3b8',
        },
        accent: {
          blue: '#3b82f6',
          cyan: '#22d3ee',
          yellow: '#f59e0b',
          green: '#4ade80',
          red: '#f87171',
          purple: '#a855f7',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
