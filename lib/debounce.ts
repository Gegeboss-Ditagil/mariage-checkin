/**
 * Regroupe des appels rapprochés en un seul, en dernier (trailing edge).
 *
 * Sert a proteger les pages abonnees au temps reel (Supabase Realtime)
 * contre une rafale d'evenements `postgres_changes` -- un reimport CSV ou
 * une correction en lot peut modifier des dizaines/centaines de lignes en
 * quelques centaines de millisecondes, ce qui declenchait autant de
 * rechargements complets en parallele sur chaque ecran ouvert. Avec ~20
 * personnes connectees en meme temps, cela multipliait les requetes
 * Supabase simultanees au pire moment (juste apres un import) et pouvait
 * ralentir tout le monde au lieu d'etre "instantane". Un seul rechargement,
 * juste apres la derniere ecriture de la rafale, donne un resultat aussi
 * frais mais sans le pic de charge.
 */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs: number
): (...args: Args) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delayMs);
  };
}
