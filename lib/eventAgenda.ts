export interface AgendaItem {
  time: string;
  title: string;
  department: string;
  details?: string;
}

// Première transcription opérationnelle du chronogramme Canva fourni le
// 31/08/2026. Les affectations nominatives et validations persistantes seront
// ajoutées lorsque Gersom transmettra la liste agents/départements complète.
export const EVENT_AGENDA: AgendaItem[] = [
  { time: '08:00', title: 'Décorateurs au Festif Chambly', department: 'Décoration', details: 'Tables, chaises, nappes, fleurs, centres de table et arche.' },
  { time: '09:00', title: 'DJ et sonorisation', department: 'Technique', details: 'Installation des haut-parleurs, micros, éclairage et tests.' },
  { time: '10:00', title: 'Traiteur', department: 'Restauration', details: 'Préparation du vin d’honneur, cocktails, entrées, plat principal, desserts et bar.' },
  { time: '11:30', title: 'Photographe et vidéaste', department: 'Média', details: 'Photos, détails, préparatifs et coulisses.' },
  { time: '12:00', title: 'Départ vers Château Jeanne & The Forest', department: 'Transport' },
  { time: '12:00–13:00', title: 'Grande séance photo', department: 'Média' },
  { time: '13:30', title: 'Départ vers le Festif Chambly', department: 'Transport' },
  { time: '14:50', title: 'Arrivée au Festif', department: 'Accueil' },
  { time: '15:00', title: 'Cérémonie religieuse', department: 'Cérémonie' },
  { time: '15:45', title: 'Séance photo rapide', department: 'Média' },
  { time: '16:00', title: 'Vin d’honneur', department: 'Restauration' },
  { time: '16:20', title: 'Départ discret des mariés', department: 'Coordination' },
  { time: '16:30–17:50', title: 'Socialisation', department: 'Accueil' },
  { time: '18:00–18:30', title: 'Entrée officielle des mariés', department: 'Animation' },
  { time: '18:30–19:00', title: 'Discours et animations', department: 'Animation' },
  { time: '19:00–20:50', title: 'Service du buffet', department: 'Restauration' },
  { time: '20:00', title: 'Mise en opération de la zone média', department: 'Média' },
  { time: '21:00', title: 'Première danse des mariés', department: 'Animation' },
  { time: '22:30', title: 'Ouverture du bal', department: 'Animation' },
  { time: '22:50', title: 'Arrivée de la prestation gâteau', department: 'Restauration' },
  { time: '01:00', title: 'Extinction des lumières et changement d’ambiance', department: 'Technique' },
  { time: '03:00', title: 'Fermeture du bar', department: 'Restauration' },
  { time: '05:00', title: 'Fin de la soirée', department: 'Coordination' },
];
