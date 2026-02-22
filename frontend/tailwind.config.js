/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#050a18',
          card: '#0c1529',
          border: '#1e293b',
          text: '#e2e8f0',
          muted: '#94a3b8',
        },
        accent: {
          blue: '#3b82f6',
          yellow: '#f59e0b',
          green: '#4ade80',
          red: '#f87171',
          purple: '#a78bfa',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
