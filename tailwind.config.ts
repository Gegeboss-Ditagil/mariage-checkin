import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1a2942',
        'ink-dark': '#0f1a2e',
        parchment: '#faf8f4',
        gold: {
          50: '#fbf7ee',
          100: '#f3e9cf',
          300: '#dcc07f',
          500: '#b8923f',
          600: '#9a7530',
          700: '#7a5c26',
        },
        status: {
          none: '#9ca3af',
          partial: '#e08a2c',
          complete: '#1f8a52',
          over: '#d13438',
        },
      },
      fontFamily: {
        display: ['Georgia', 'Cambria', 'serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      spacing: {
        tap: '3.25rem',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
