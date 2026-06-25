import type {Config} from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      borderRadius: {
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
      },
      fontFamily: {
        dongle: ['Dongle', 'sans-serif'],
        gruppo: ['Gruppo', 'sans-serif'],
        kantumruy: ['Kantumruy Pro', 'sans-serif'],
        lato: ['Lato', 'sans-serif'],
        mono: ['Courier New', 'monospace'],
        montserrat: ['Montserrat', 'sans-serif'],
        'old-turkic': ['Noto Sans Old Turkic', 'sans-serif'],
        padauk: ['Padauk', 'sans-serif'],
        puritan: ['Puritan', 'sans-serif'],
        'roboto-condensed': ['Roboto Condensed', 'sans-serif'],
        'ubuntu-mono': ['Ubuntu Sans Mono', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
