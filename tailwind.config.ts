import type { Config } from 'tailwindcss';

// Nhan dien thuong hieu OnPoint. Da co dinh, dung tu doi.
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        red:  { DEFAULT: '#D43A38', deep: '#99302D', grad: '#E8443A', gradEnd: '#7E1F26' },
        teal: { DEFAULT: '#0093A3', deep: '#0C3D47', gradEnd: '#103A52' },
        surface: { DEFAULT: '#FFFFFF', sunk: '#F8FBFB', page: '#EDF4F3' },
        line: { DEFAULT: '#E2ECEA', strong: '#C3D8D5' },
        ink: { DEFAULT: '#0E2228', dim: '#3E5A61', faint: '#7A949A' },
      },
      fontFamily: {
        display: ['Anton', 'Arial Narrow', 'Impact', 'sans-serif'],
        sans: ['Aptos', 'Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'grad-teal': 'linear-gradient(135deg, #0093A3 0%, #103A52 100%)',
        'grad-red':  'linear-gradient(135deg, #E8443A 0%, #7E1F26 100%)',
      },
    },
  },
  plugins: [],
} satisfies Config;
