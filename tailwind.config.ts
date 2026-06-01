import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        space: '#0a0e1a',
        mars: '#ff6b35',
        cyan: '#00d9ff',
        res: { o2: '#4ade80', h2o: '#3b82f6', ore: '#fb923c', eng: '#facc15', rsh: '#a78bfa' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
