import { redirect } from 'next/navigation';

// L'ancienne vue d'ensemble faisait doublon avec /plan-table. Conserver
// cette route comme redirection serveur protège les favoris, PWA et anciens
// liens tout en évitant un montage client/scanner intermédiaire.
export default function TablesRedirectPage() {
  redirect('/plan-table');
}
