import { randomInt } from 'crypto';

// v1.65.0 : genere un nouveau PIN aleatoire (meme format 4 chiffres que la
// saisie manuelle existante, /admin/users) et l'indice masque correspondant
// -- jamais le PIN en clair stocke nulle part, seul `pin_hash` (scrypt,
// lib/auth.ts) et cet indice survivent a la reinitialisation.
export function generateRandomPin(): string {
  return String(randomInt(0, 10000)).padStart(4, '0');
}

// "Seulement les deux derniers caracteres, le reste en asterisques" (demande
// explicite de Gersom) -- jamais reversible vers le PIN complet, juste de
// quoi rappeler un mot de passe deja communique avant de reinitialiser pour
// de bon.
export function maskPinForHint(pin: string): string {
  if (pin.length <= 2) return pin;
  return '*'.repeat(pin.length - 2) + pin.slice(-2);
}
