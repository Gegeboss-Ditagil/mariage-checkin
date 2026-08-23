import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#1a2942',
        'ink-dark': '#0f1a2e',
        parchment: '#faf8f4',
        night: {
          950: '#070f0a',
          900: '#0c1912',
          800: '#11241a',
          700: '#1a3324',
          600: '#264530',
          500: '#3a5c42',
        },
        cream: '#f6f1e4',
        gold: {
          50: '#fbf7ee',
          100: '#f3e9cf',
          200: '#ecd9a8',
          300: '#dcc07f',
          400: '#d4af6a',
          500: '#b8923f',
          600: '#9a7530',
          700: '#7a5c26',
          900: '#4a3714',
        },
        status: {
          none: '#9ca3af',
          partial: '#e08a2c',
          complete: '#1f8a52',
          over: '#d13438',
        },
        nelly: '#d6336c',
        gege: '#1d4ed8',
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
        xl3: '1.75rem',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06)',
        gold: '0 8px 24px rgba(212,175,106,0.25)',
      },
      backgroundImage: {
        'night-radial': 'radial-gradient(120% 90% at 50% -10%, #1a3324 0%, #0c1912 55%, #070f0a 100%)',
      },
    },
  },
  plugins: [],
};

export default config;


