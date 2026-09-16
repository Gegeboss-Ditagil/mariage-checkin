// Noms de sieges lus par OCR sur les deux photos du plan de table transmises
// par Gersom le 14/09/2026 (nouvelle configuration, v1.48.0). PUREMENT
// INFORMATIF -- ce n'est PAS la source de placement de l'application (qui reste
// invitations.table_id, seule source ecrite/autoritative, cf.
// docs/DATA_CHANGE_INSTRUCTIONS.md section 6). Sert uniquement a afficher, a
// titre indicatif, qui la famille avait prevu de faire asseoir a cette table
// au moment de la photo -- jamais ecrit en base, jamais utilise pour decider
// une assignation. Ordre des sieges : dans le sens horaire en partant du haut,
// tel que visible sur chaque photo (schema circulaire a 10 places). `null` =
// siege vide sur la photo (numerote mais sans etiquette de nom).
//
// Extraction methodique (OCR zoome table par table) puis recoupee avec la base
// (voir tests/floor-plan-seats.test.ts) : ~87% des noms nommes retrouvent une
// invitation existante (memes table, ou table differente si la famille a
// reorganise depuis, ou parmi les 19 invitations recemment ajoutees sans table
// -- cf. CHANGELOG v1.47.0). Le reste (accompagnants non nommes, ou personnes
// dont seul le nom de famille groupe existe en base) n'invalide pas la lecture,
// juste hors de portee d'une correspondance nom a nom automatique.
//
// v1.53.3, dernier assessment demande par Gersom (16/09/2026, capture d'ecran
// table 4 -- "Fiston, c'est ecrit Fixton [Fixon]... fais un dernier
// assessment sur toutes les chaises... vu que tu sais deja sur quelle table,
// ca va etre facile de faire un match") : recoupement systematique des 393
// sieges nommes avec les 250 invitations actuellement en base (nom_affichage
// + membres detailles des notes), TABLE PAR TABLE uniquement (jamais entre
// deux tables differentes -- deux personnes peuvent avoir des noms tres
// proches sur des tables distinctes, voir plus haut). 75 corrections de
// lecture OCR appliquees, chacune la seule candidate plausible sur SA table
// avec une marge de confiance nette au-dessus de la deuxieme meilleure
// correspondance (ex. "Fixon Zola" -> "Fiston Zola", "Jean-Ciben Ca ous" ->
// "Jean-Clivens Le Caous", deja identifiee en v1.48.0 mais jamais reportee
// ici). 13 cas restent ambigus (plusieurs candidats trop proches sur la
// meme table, ex. table 4 "Henri O. Momba"/"Henricia O. Momba" face a
// "Henri Onatshungu Momba"/"Henriela Onatshungu Momba") et 5 sans aucun
// candidat -- volontairement PAS devines, signales a Gersom (voir CHANGELOG
// v1.53.3) plutot que corriges au hasard. Deux ecarts de table 40/41
// (Bembo/Mateus, Diego Ramos/Jade Magnus) sont des divergences deja connues
// entre la photo et les reorganisations ulterieures (v1.50.0), pas des
// erreurs de lecture -- volontairement laisses tels quels, la photo reste un
// instantane fidele au moment ou elle a ete prise.
export const TABLE_SEAT_NAMES: Record<number, (string | null)[]> = {
  1: ["Herve Menga", "Jean-Clivens Le Caous", null, "Hadelin Yezi", "Domingas Ferreira", null, "Deborah Yezi", "Lys Landu", "David-Junior Lukau", "Eutyche Lukau"],
  2: ["Erika Dos Goncalves", "Isabel Vemba", "Mona Vemba", "Deusdedit Dos Goncalves", "Jael Dos Goncalves", "Luis Dos", "Gaby Dos", null, null, null],
  3: ["Neves Kiombi Nzuzi", "Leverry Kinzi", "Jonas Mpindi", "Henry Kiadi Ndiongo", "Sumali Ndiongo", "Diton Kiala Diamena", "Oredezo Blancky", "Costa Mvovi", "Invité n.n. (338)", "Edo Tukula"],
  4: ["Michela Teka Sanda", "Henri O. Momba", "Henricia O. Momba", "Thierry Mbiyavanga Mavinga", "Dorothée Deborah Nsingani", "Stacky M. Mavinga", "Kelcy Mbiyavanga Mavinga", "Jessy B. M. Mavinga", "Taylor Mbiyavanga Mavinga", "Fiston Zola"],
  5: ["Maria Mputuilu", "Graça Inacio", "André Neves", "Chantal Neves", "Papa David Lukau", "Maman Josefina Lukau", "Edouard Kiaku Mbuta", "femme edo kiaku mbuta", "Elisa Jean", "Alfred Jean"],
  6: ["Nsimba Mambakasa", "Helder Vemba", "Kupesa Lando Ferreira", "Eugenia Sengo Chipala", "Mbulu Esamba", "Tchecka Mbulu", "Papy Mamona", "Adriano Vemba", "Merveille Makaya", "Pajos Mpapa"],
  7: ["Filho 1 Culumbu", "Epoux Tia Sonia", "Sarah Tahan", "Seda Tahan", "Tia Sonia Culumbu", "Femme Culumbu", "Filho 4 Culumbu", "Tio Gilie Culumbu", "Filho 3 Culumbu", "Filho 5 Culumbu"],
  8: ["Lale Culumbu", "Celestina Yezi", "Mahjo Yezi", "Odette Culumbu", "Waku Menga", "Julie Indanda", "Simao Guilherme", "Michelina Guilherme", "Luzolo P. Menga", "Tia Nzuzi Culumbu"],
  9: ["Mamita Ndani", "Eric Lema", "Lotine André", "André Nsiangangu", "Femme Nsiangangu", "Enfant Nsiangangu", "Maurice Ndani Ndoba", "Keyris Ndani", "Giresse Juliano Nzengo", "Grace Tshisungu"],
  10: ["Stephanie Buluka Mituele", "Rose-marie Kumba", "Qeren Moba-Mbemba", "Naomie Ghansi", "Kevin GHANSI", "Josué Ghansi", "Fyra Biyoudi", "Chindelle Moba-Mbemba", "Ruth Mwimba", "Ted Mwinba"],
  11: ["Teresa Ndani", "Loïc Neves", "Gloire André", "Gabriel Skoty Sanda", "Andrea Neves", "Ketsia Neves", "Jonathan Ndani", "Bontee Tercia Ndani", null, null],
  12: ["Sylvie Bulisi", "Louise Ngonda Nsenga", "Nana Mabumba", "Felix Luboya", "Tatiana Bitumazala", "Yvon Bitumazala", "Diane Eberhorn", "Rose Bulisi", "Joana Lusuena", "Fifi Lusuena"],
  13: ["Simon Mbidi", "Mona Guygson Vemba", "Suzie Vemba", "Abeti Okito", "Johny Okito", "Bijou Mambakasa", "Gisèle Mambakasa", "Rolly Makaya Mvemba", "Johny Kiala", "Danyl Mbidi"],
  14: ["Jordy Ungeli", "Dorcas Massamba", "Hugo Massamba", "Imeon Massamba", "Ludovic Eckomband", "Sita Muzemba", "Stephenson Bulaki", "Garile Bulaki", "Carl Aye", "Enricka Aye"],
  15: ["Tuzola Saviera", "Keith Saviera", "Riffick Saviera", "Mercia Saviera", "Sister 2 Malungu", "Ruben Kinanga Malungu", "Maguy Malungu", "Sister 1 Malungu", "Keziah Malungu", null],
  16: ["Djessus Steano Tulomba", "Yeze Zinga", "Sephora Tulomba", "Jessica Tulomba", "Silva Mvuemba", "Melissa Mvuemba", "Yomo Formosa", "Denzu Laisana", "Olivier Benga", null],
  17: ["Jessica Jean", "Joelis Jean", "Jeremie Luyindula", "Lynda Luyindula", "Gloria Luyindula", "Manuela Zerrougui", "Raffik Zerrougui", "Aimé Luyindula", "Prémices Jean", "Deborah Brigitte"],
  18: ["Furty Matuba", "Melanie Matuba", "Bernard Kadina", "Sylvie Kadina", "Regine Nkoyi", "Victor Nkoyi", "Marie-Chantal Kiangala", "Graça Lorena Gomes", "Zola Martine Gomes", "Maria Irene Gomes"],
  19: ["Vicky Nsumbu Mvuza", "Ben Messan", "Anais Messan", "Benson Messan", "Adeline Makopa", "Kemal Makiese", "Michele Isolonge", "Christine Kaseka", "Bionic Kileki", "Tryphène Kileki"],
  20: ["Carine Sagbo", "Dany Dasilva", "Felicia Ndedi", "Prosper Chi Nche", "Sylviane Jeanne", "Ghislain Mayemba", "Charlene Coulibaly", "Souleyman Gassama", "Divine Masiala", "Awa Kamate"],
  21: ["Nolivia Bitsindou", "Line Kwatchou", "Additional Guest 1", "Sidney Momoh", "Onehi Momoh", "Silyann Bitouloulou", "Mamàn P. Alvero", "Papa Sam Alvero", "Sam jr. Alvero", "Shayann Alvero"],
  22: ["Mickaël Ribeiro", "Laurie-Anne Ribeiro", "Arcange Ntokua", "Dias Ntokua", "Adrienne Mbangu", "Elina Joseph", "Valerie Joseph", "Daniel Joseph", "David Cairaschi", "Grâce Ndonga"],
  23: ["Miguel Bemvindo", "Josly Nuamosi-Mbambu", "Melina Kiangala", "Lizéa Mbila", "Jerode Muzezenu", "Henriette Muzezenu", "Tsippora Miakukila", "Khezia Miakukila", "Erwann Kadina", "Elda Makuntima"],
  24: ["Isaac Lotisi", "Rosie Unzitisa", "Sebastien Unzitisa", "Lily Nuamosi", "José Nuamosi", "Josian Nuamosi", "Joan Nuamosi", "Rosette Bolamba", "Koffi Bolamba", "Sévrine Lotisi"],
  25: ["Odette Muzezenu", "Jerry Muzezenu", "Chantale Muzezenu", "Jerry Junior Muzezenu", "Maguy Mawete Makinu", "Alain Nsakala", "Anita Nsakala", "Mifi Mbiki", "Serge Mbiki", "Etienne Mawete Makinu"],
  26: ["Ashnee Barclay", "Cedrik LeCaous", "Maman Sunette Jean-Baptiste", "Dylan Lorsold", "Maeva Lorsold", "Jonathan Kumbi", "Anne Fuema", "Mika Fleurival", "Dan Elenga", "Cédric Tyller BELINGA"],
  27: ["Amie de Naomi", "Karl Isolokele", "Mademoissele Isokolele", "Frank Mbonda", "Sami Simon", "Jovany Germain", "Henry Karl Jeantine", "Momo Sidibe", "Naomi SHANGO", "Vanilla TJOM"],
  28: ["Celestina Mundanda Nsita", "Amy Eiano", "Paul Mundanda Nsita", "Renense Mundanda Nsita", "Tressy Mundanda Nsita", "Pauliana M. Nsita", "Niveline Mbangu", "Nicole Mbangu", "Accompagnant non-nommé", "Accompagnant non-nommé"],
  29: ["Rafael Opetum Isei", "Prince Nzasi", "Babel Nzasi", "Sergio Manuel", "Rene Herrera", "Ya Dany Culumbu", "Weplo Culumbu", "Accompagnant non-nommé", "Laura Humba", "Enfant Nsasi"],
  30: ["Sem Landu", "Dorine Landu", "Roger Landu", "Nadine Landu", "Richard Landu", "Denise Landu", "Rémy Landu", "Betty Jeanne Closse", "Lucien Closse", "Daeve Landu"],
  31: ["Debest Pello", "Claudine Pello", "Odette Manuel", "Nadine Kimbau", "Steven Kimbau", "Antoinette Kimbau", "Cady Belida", "Marleine Bansimba", "Laetitia Bongo", "Youyou Lembe Tchiteya"],
  32: ["Accompagnant non-nommé", "Lucie Nzuzi", "Seba Domingos", "Lina Kumpesa", "Guillaume Mayimakanda", null, "Yves Elima", "Charlene Elima", "Maman Elima", "Clavert Domingos"],
  33: ["Emilia Mbidi", "Esmeralda Vemba", "Plamedi Okito", "Darleine Okito", "Estelle Okito", "Anne Kaylee Mambakasa", "Kheira Mambakasa", "Kenaya Mambakasa", "Makaia Vemba Ferreira", "Isabel Ferreira"],
  34: ["Veronique Nsenda", "Jean-Claude Nsenda", "Noel Nsenda", "Moïse Nsenda", "Aurelie Nsenda", "Augustin Nsenda", "Ruben Lopez", "Martinette Lopez", "Gladys Lopez", "Eden Lopez"],
  35: ["Maguy Luvuasi", "Geodray Luvuasi", "Kamal Bekka", "Marta Bekka", "Ines Bekka", "Clement Luvuasi", "Brady Landu", "Victoria Landu", "Allegria Mpilingi", "Dylan Landu"],
  36: ["Femme Michaud", "Sylvia Mpiassa", "Joao Mpiassa", "Darliane Mpiassa", "Jeansianne Mpiassa", "Lumbu Mabanza Joël", "Joeliane Elmacin", "Helga Lumbu", "Lina Lumbu", "Michaud Cujumbu"],
  37: ["Fatou Diaby", "Bangaly Souaré", "Yannick Abdoul Camara", "Tiphaine Abdoul Camara", "Thomas Wandubula", "Jean-Claude Onokoko", "Cécile Mbila", "Jean Mbila", "Denise Nkoussou", null],
  38: ["Accompagnant non-nommé", "Nicole Tusevo", "Elvis Tusevo", "Accompagnant non-nommé", "Accompagnant non-nommé", "Divine Simao", "Dorcas Matembe", "Nadia Mabata", "Accompagnant non-nommé", null],
  39: ["Ahicam Damuna", null, "Priscile Makuntima", "Lucien Shampe", "Isidore Luyindula", "Glody Kambwa", "Léna Vinelle Nganga", "Jeanne Tona", "Hélène Tona", "Barnabe Shungu"],
  40: ["Julianna Matondo", "Jennifer Bembo", "Joël Bembo", "Jessiline Mateus", "Bob Culumbu", "Dislon Lumbu", "Manucho Lumbu", "Eude Matondo", "Francisco Matondo", "Huguette Matondo"],
  41: ["Jacquie Menga", "Lambert Menga", "Bana Menga", "Bana Menga", null, null, null, null, "Diego Ramos", "Jade Magnus"],
  42: [null, null, null, null, null, null, null, null, null, null],
};

// v1.48.5, demande de Gersom : afficher ce dessin sur la fiche d'un invité
// (/checkin/[invitationId]) et permettre de surligner un siège depuis la
// liste d'invitations d'une table sélectionnée (/plan-table) -- les deux
// nécessitent de retrouver l'INDEX du siège d'une personne connue par son
// nom, à l'intérieur d'une table donnée (jamais une recherche floue sur les
// 42 tables : deux personnes différentes peuvent avoir des noms très proches,
// ex. "Andrea Neves" et "André Neves", chacune sur une table différente --
// une tolérance approchée risquerait de désigner le mauvais siège). La table
// elle-même vient toujours de la vraie source de placement
// (invitations.table_id), jamais devinée : ne compare qu'à l'intérieur de la
// table déjà connue.
function normalizeSeatName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Correspondance EXACTE (accents/casse ignorés) entre `name` et l'un des
 * sièges lus sur la photo pour la table `tableNumber`. Retourne `null` si la
 * table n'a pas de lecture, ou si aucun siège ne correspond exactement --
 * jamais une supposition.
 */
export function findSeatIndexByName(tableNumber: number, name: string): number | null {
  const seats = TABLE_SEAT_NAMES[tableNumber];
  if (!seats) return null;
  const target = normalizeSeatName(name);
  if (!target) return null;
  const index = seats.findIndex((seat) => seat !== null && normalizeSeatName(seat) === target);
  return index === -1 ? null : index;
}

/**
 * v1.48.9, retour de Gersom : "vice versa -- si j'appuie sur la chaise...
 * ça me surligne directement... c'est qui" -- meme comparaison EXACTE
 * (accents/casse ignores, jamais approchee) que `findSeatIndexByName`, mais
 * exposee pour le sens inverse : partir d'un nom lu sur un siege et
 * retrouver, parmi une liste d'invitations/membres DEJA CONNUE de
 * l'appelant (jamais une recherche sur les 42 tables), celle qui correspond.
 */
export function namesMatch(a: string, b: string): boolean {
  const left = normalizeSeatName(a);
  const right = normalizeSeatName(b);
  return left !== '' && left === right;
}
