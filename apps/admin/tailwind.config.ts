import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
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
          100: '#FFE9DF',
          500: '#FF6B35',
          700: '#E55A25',
          900: '#1A1A2E',
        },
        status: {
          new: '#3B82F6',
          confirmed: '#10B981',
          preparing: '#F59E0B',
          ready: '#8B5CF6',
          delivered: '#6B7280',
          cancelled: '#EF4444',
        },
      },
      borderRadius: {
        lg: '12px',
        xl: '14px',
        '2xl': '20px',
      },
      fontFamily: {
        jakarta: ['Plus Jakarta Sans', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
