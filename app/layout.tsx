@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light;
}

html, body {
  height: 100%;
  -webkit-tap-highlight-color: transparent;
  overscroll-behavior-y: contain;
}

body {
  @apply bg-parchment text-ink antialiased;
}

/* Boutons tactiles larges, faciles a utiliser debout d'une seule main */
.btn-tap {
  @apply flex items-center justify-center min-h-tap px-6 py-3 rounded-xl2 font-semibold text-lg
    active:scale-[0.98] transition-transform select-none;
}

.btn-primary {
  @apply btn-tap bg-ink text-white shadow-card;
}

.btn-secondary {
  @apply btn-tap bg-white text-ink border border-black/10 shadow-card;
}

.btn-danger {
  @apply btn-tap bg-status-over text-white shadow-card;
}

.card {
  @apply bg-white rounded-xl2 shadow-card border border-black/5 p-4;
}

.safe-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}

.safe-top {
  padding-top: env(safe-area-inset-top);
}
