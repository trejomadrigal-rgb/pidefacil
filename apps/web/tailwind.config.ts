import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FFF4EF',
          100: '#FFE4D5',
          200: '#FFC5A8',
          300: '#FF9F73',
          400: '#FF7A47',
          500: '#FF6B35',
          600: '#E85A25',
          700: '#C44A1A',
          800: '#A03C14',
          900: '#1A1A2E',
        },
      },
      fontFamily: {
        sans: ['var(--font-plus-jakarta)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
