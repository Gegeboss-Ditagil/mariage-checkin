'use client';

// Le navigateur annule (skipTransition()) une View Transition encore en vol
// des qu'une nouvelle navigation en demarre une autre pendant qu'elle anime
// -- exactement ce qui arrive en cliquant/naviguant rapidement plusieurs
// fois de suite ("je clique partout"). Ce n'est jamais un bug : la
// specification garantit que l'annulation nettoie immediatement le
// pseudo-arbre de la transition precedente. Mais la promesse rejetee par le
// navigateur (le message ci-dessous, texte standard du moteur, jamais
// produit par notre propre code) remonte comme `unhandledrejection` si
// `next-view-transitions` ne la capture pas -- journalisee jusqu'ici comme
// une vraie erreur (level: 'error'), alors que 7 des 10 dernieres lignes de
// `app_logs` avant ce correctif n'etaient que ce bruit, noyant les vrais
// signaux (ex: la timeout corrigee en v1.62.0).
export function isBenignViewTransitionRejection(message: string | undefined | null): boolean {
  if (!message) return false;
  return (
    /Skipping view transition because skipTransition\(\) was called\.?/i.test(message) ||
    /View transition was skipped because document visibility state is hidden\.?/i.test(message)
  );
}
