import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0a0a0a',
        panel: '#0e0e0e',
        line: '#222222',
        fg: '#e6e6e6',
        dim: '#666666',
        ok: '#3ddc84',
        warn: '#ffb020',
        bad: '#ff5c5c'
      }
    }
  },
  plugins: []
} satisfies Config
