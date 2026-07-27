import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: { 50: '#eff6ff', 100: '#dbeafe', 500: '#2563eb', 600: '#1d4ed8', 700: '#1e40af', 950: '#172554' },
      },
      boxShadow: { panel: '0 1px 2px rgba(15, 23, 42, .04), 0 8px 24px rgba(15, 23, 42, .04)' },
    },
  },
  plugins: [],
};

export default config;
