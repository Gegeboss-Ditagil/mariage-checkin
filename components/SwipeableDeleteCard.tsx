'use client';

import { useRef, useState } from 'react';
import { TrashIcon } from '@/components/icons';

// v1.53.2 : premiere tentative (verrouillage d'axe -- ne capturer le
// pointeur qu'une fois le geste tranche horizontal/vertical) pour un bug
// signale par Gersom sur iOS ("je ne peux pas swipe left or right"). Confirme
// insuffisant par un second test reel : aucune reaction au glissement, meme
// partielle -- le defilement vertical natif fonctionnait, mais aucun
// pointermove horizontal exploitable n'atteignait jamais React.
//
// v1.53.4 : deuxieme tentative (capture immediate du pointeur des la mise
// en contact, en s'appuyant sur `touch-action: pan-y` + l'evenement natif
// d'annulation de geste pour laisser le defilement vertical reprendre la
// main). Confirmee insuffisante elle aussi par un troisieme test reel :
// toujours aucune reaction au glissement.
//
// v1.53.7 : deux echecs consecutifs de Pointer Events sur le meme appareil
// suggerent que le probleme n'est pas dans le detail de la gestion du geste
// mais dans l'approche elle-meme -- reconstruire manuellement en JS ce que le
// defilement natif fait deja tres bien. Retour de Gersom (capture d'ecran de
// Messages iOS) : "on slide et on voit le bouton trash... comme sur
// l'iPhone" -- exactement le motif qu'un conteneur de defilement horizontal
// avec scroll-snap produit nativement, sans aucune ligne de JS de geste :
// chaque carte devient elle-meme un petit conteneur `overflow-x-auto` a deux
// panneaux (contenu, puis bouton supprimer), le navigateur gerant seul le
// glissement, l'inertie ET la cohabitation avec le defilement vertical de la
// liste (deux axes orthogonaux, jamais en conflit par construction -- pas de
// verrouillage d'axe a coder). Le bouton de suppression explicite ajoute en
// v1.53.6 (icone poubelle a cote du badge de statut) reste en place en
// parallele, au cas ou ce troisieme mecanisme se heurterait lui aussi a une
// particularite non anticipee de son appareil.
//
// v1.53.8, retour de Gersom (confirme fonctionnel sur son iPhone) : (1) le
// panneau de suppression devient un icone circulaire rouge (jamais un
// aplat rectangulaire plein), fidele au motif Mute/Trash de Messages iOS
// (capture d'ecran transmise en reference) -- le fond du panneau reste
// transparent (le meme arriere-plan que la liste transparait), seul le
// cercle porte la couleur. (2) `min-w-full` (min-width seulement) laissait
// un contenu plus large que la carte (ex. un long libelle de bouton) forcer
// le conteneur de defilement a s'elargir au-dela de la largeur visible,
// coupant net le badge de statut et le texte du bouton "Reconsiderer" --
// `w-full` + `overflow-hidden` bornent desormais strictement le panneau de
// contenu a la largeur de la carte, quel que soit ce qu'il contient.
const ACTION_WIDTH = 88;
const ACTION_CIRCLE_SIZE = 52;

export function SwipeableDeleteCard({
  enabled,
  onDelete,
  children,
}: {
  enabled: boolean;
  onDelete: () => void | Promise<void>;
  children: React.ReactNode;
}) {
  const [deleting, setDeleting] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  if (!enabled) return <>{children}</>;

  function handleDeleteClick() {
    if (deleting) return;
    setDeleting(true);
    void Promise.resolve(onDelete());
  }

  return (
    <div className="relative overflow-hidden rounded-xl2">
      <div
        ref={scrollerRef}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth overscroll-x-contain"
      >
        <div
          className="w-full shrink-0 snap-start overflow-hidden"
          style={{ opacity: deleting ? 0.4 : 1, transition: 'opacity 200ms ease-out' }}
        >
          {children}
        </div>
        <button
          type="button"
          aria-label="Supprimer définitivement"
          disabled={deleting}
          onClick={handleDeleteClick}
          className="flex shrink-0 snap-end items-center justify-center disabled:opacity-60"
          style={{ width: ACTION_WIDTH }}
        >
          <span
            className="flex items-center justify-center rounded-full bg-status-over text-white shadow-elev-2 transition-transform active:scale-90"
            style={{ height: ACTION_CIRCLE_SIZE, width: ACTION_CIRCLE_SIZE }}
          >
            <TrashIcon className="h-6 w-6" />
          </span>
        </button>
      </div>
    </div>
  );
}
