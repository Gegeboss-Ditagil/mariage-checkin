import type { Config } from 'tailwindcss';

const config: Config = {
  // Bascule manuelle (menu de compte -> hooks/useTheme.ts) ou "Automatique"
  // qui suit prefers-color-scheme en direct : voir hooks/useTheme.ts pour la
  // resolution. Le rendu reste toujours pilote par l'attribut data-theme.
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Systeme "Atrium" (clair) / "Maison" (sombre) : deux jeux de valeurs
        // pilotes par [data-theme] dans app/globals.css, exposes ici comme
        // couleurs Tailwind pour garder les memes utilitaires (bg-bg,
        // text-text, border-hairline...) partout dans le JSX existant.
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        text: 'var(--text)',
        'text-muted': 'var(--text-muted)',
        'text-faint': 'var(--text-faint)',
        hairline: 'var(--hairline)',
        accent: 'var(--accent)',
        'accent-strong': 'var(--accent-strong)',
        'accent-tint': 'var(--accent-tint)',
        'on-accent': 'var(--on-accent)',
        glass: 'var(--glass)',
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
        // Titres generaux : Inter dans les deux modes (voir handoff). Seuls
        // les noms de personnes/tables et grands nombres passent en serif en
        // Maison via la classe .font-name (globals.css).
        display: ['var(--font-sans)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['var(--font-display-serif)', 'Georgia', 'Cambria', 'serif'],
        sans: ['var(--font-sans)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      spacing: {
        tap: '3.25rem',
      },
      borderRadius: {
        xl2: '1.25rem',
        xl3: '1.75rem',
        xl4: '1.75rem',
      },
      boxShadow: {
        card: 'var(--elev-1)',
        'elev-2': 'var(--elev-2)',
      },
    },
  },
  plugins: [],
};

export default config;
