// Noms de sieges lus par OCR sur les 4 photos de zones (Nord-Est, Nord-Ouest,
// Sud-Est, Sud-Ouest) transmises par Gersom le 04-05/10/2026 (plan de table
// FINAL seatplan.io, 41 tables, voir supabase/migrations/0061 et le
// CHANGELOG v1.68.0). PUREMENT INFORMATIF -- ce n'est PAS la source de placement
// de l'application (qui reste invitations.table_id, seule source
// ecrite/autoritative, cf. docs/DATA_CHANGE_INSTRUCTIONS.md section 6). Sert
// uniquement a afficher, a titre indicatif, qui la famille avait prevu de
// faire asseoir a cette table au moment de la photo -- jamais ecrit en base,
// jamais utilise pour decider une assignation. Ordre des sieges : dans
// l'ordre de lecture de chaque photo (schema circulaire a 8-12 places selon
// la table). `null` = siege vide ou personne de la photo introuvable parmi
// les invitations reellement placees a cette table.
//
// Methode (v1.68.0, remplace entierement les donnees v1.48.0-v1.53.11 --
// ancienne structure a 42 tables, zones nord/sud) : pour chaque table, les
// MEMBRES REELS actuellement places a cette table (invitations.table_id,
// apres la mise a jour groupee de ce lot) servent de "menu" ferme de noms
// exacts -- la photo ne sert plus qu'a determiner l'ORDRE des sieges, jamais
// l'orthographe (meme principe que v1.53.11, applique ici au nouveau plan).
// Correspondance par recouvrement de mots (jamais une tolerance approchee
// qui risquerait un mauvais siege), TABLE PAR TABLE uniquement. Les noms de
// la photo sans aucune correspondance parmi les membres reels de cette table
// (famille non retrouvee en base, ex. "Dany Lukoki" table 40, ou person
// genuinement absente de notre liste, ex. "Kai Choy"/"Alyson Choy" table 27)
// restent `null` -- jamais devines. A l'inverse, un membre reellement place
// a une table mais absent de la lecture photo (ex. accompagnants non nommes
// individuellement) est ajoute en fin de liste plutot que perdu.
export const TABLE_SEAT_NAMES: Record<number, (string | null)[]> = {
  1: ["Ketsia Neves", "David-Junior Lukau", "Eutyche Lukau", "Teresa Ndani", "Herve Menga", "Hadelin Yezi", "Deborah Yezi", "Domingas Ferreira", null, "Lys Landu"],
  2: [null, "Erika Dos Goncalves", "DeMbala Dos Goncalves", "Keith Saviera", null, "Gaby Dos", "Luis Dos", "Mona Vemba", "Tuzola SAVIERA", "Isabel Vemba", "Cedrix", "Jael Dos Goncalves"],
  3: ["Edo Tukula", "Neves Kiombi Nzuzi", "Leverry Kinzi", "Jonas Mpindi", "Costa Mvovi", "Oredezo Blancky", "Diton Kiala Diamena", "Sumali Ndiongo", "Henry Kiadi Ndiongo", null, "Epouse Mvovi"],
  4: ["Fiston Zola", "Michela Teka sanda", "Henri Onatshungu Momba", "Taylor Mbiyavanga Mavinga", "Henriela Onatshungu Momba", "Thierry Mbiyavanga Mavinga", "Staicy Mbiyavanga Mavinga", "Kelcy Mbiyavanga Mavinga", "Jessy Buka Mbiyavanga Mavinga", "Dorothée Deborah Nsingani"],
  5: ["Elisa Jean", "Alfred Jean", "Maria Mputuilu", "femme edo kiaku mbuta", "Graça Inacio", "Andre Neves", "Edouard Kiaku Mbuta", "Maman Josefina Lukau", "Papa David Lukau", "Chantal Neves"],
  6: ["Papy Mamona", null, "Adriano Vemba", "Helder Vemba", "Tchecka Mbulu", "Merveille Makaya", "Eugenia Sengo chipala", "Kupesa Lando Ferreira", null, null, "Mbulu Esamba", "Nsimba Mambakasa", "Pajos Mpapa"],
  7: ["Filho 1 Culumbu", "Filho 4 Culumbu", null, null, null, "Tio Gilie Culumbu", "Filho 3 Culumbu", "Femme Culumbu", "Jessiline Mateus", "Filho 5 Culumbu"],
  8: [null, "Mahjo Yezi", "Celestina Yezi", null, "Sarah Tahan", "Seda Tahan", "Lale Culumbu", "Sylvia Mpiassa", "Darliane Mpiassa", null, "Joao Mpiassa", "Jeansianne Mpiassa"],
  9: ["Mamita Ndani", "Lotine André", "Grace Tshisungu", "Giresse Juliano Nzengo", "Andre Nsiangangu", "Femme Nsiangangu", "Keyris Ndani", "Maurice Ndani Ndoba", "Enfant Nsiangangu", null],
  10: [null, "Stephanie Buluka mituele", "Rose-marie Kumba", null, "Chindelle Moba-Mbemba", "Fyra Biyoudi", "Josué Ghansi", "Kevin GHANSI", "Qeren Moba-Mbemba", "Naomie Ghansi", "Eric Lema"],
  11: ["Diego Ramos", "Zoya Inacio", "Loïc Neves", "Gloire André", "Bontee Tercia Ndani", "Jonathan Ndani", "Andrea Neves", "Gabriel Skoty Sanda", null, null],
  12: ["Fifi Lusuena", "Sylvie Bulisi", "Louise Ngonda Nsenga", "Nana Mabumba", "Joana Lusuena", "Rose Bulisi", "Yvon Bitumazala", "Diane Eberhorn", "Felix Luboya", "Tatiana Bitumazala"],
  13: ["Johny Kiala", "Rolly Makaya Mvemba", "Mona Guygson Vemba", null, "Abeti Okito", "GISELE MAMBAKASA", "BIJOU MAMBAKASA", "Simon Mbidi", "Suzie Vemba", "Danyl Mbidi", "Johny Okito"],
  14: ["Enricka Aye", "Jordy Ungeli", "Dorcas Massamba", "Carl Aye", "Gaelle Bulaki", "Stephenson Bulaki", "Sita Muzemba", "Ludovic Eckomband", "Hugo Massamba", "Imeon Massamba"],
  15: ["Rafael Opetum Isei", "Weplo Culumbu", null, "Epouse Godart", "Tia Sonia Culumbu", null, "Epoux Tia Sonia", null, "Tio Godart Culumbu", null],
  16: ["Denzu Laisana", "Djessus Steano Tulomba", "Yeze Zinga", "Olivier Benga", "Sephora Tulomba", "Yomo Formosa", "Melissa Mvuemba", "Silva Mvuemba", "Jessica Tulomba", null],
  17: ["Déborah Brigitte", "Jessica Jean", "Joelis Jean", "Prémices Jean", "Aimé Luyindula", "Lynda Luyindula", "Manuela Zerrougui", "Raffik Zerrougui", "Jeremie Luyindula", "Gloria Luyindula"],
  18: ["Graca Lorena Gomes", "Furty Matuba", null, "Zola Martine Gomes", "Bernard Kadina", "Maria Irène Gomes", "Sylvie Kadina", "Marie-Chantal Kiangala", "Regine Nkoyi", "Victor Nkoyi", "Melanie Matuba"],
  19: ["Bionic Kileki", "Vicky Nsumbu Mvuza", "Ben Messan", "Anais Messan", "Tryphène Kileki", "Christine Kaseka", "Michèle Isolonge", "Kemal Makiese", "Benson Messan", "Adeline Makopa"],
  20: ["Charlene Coulibaly", "Sylviane Jeanne", "Felicia Ndedi", "Prosper Chi Nche", "Ghislain Mayemba", "Dany Dasilva", "Souleyman Gassama", "Awa Kamate", "Divine Masiala", null, "Carine Sagbo"],
  21: [null, "Nolivia Bitsindou", "Line Kwatchou", null, "Sam jr. Alvero", "Papa Sam Alvero", "Maman Pitchou Alvero", "Silyann Bitouloulou", "Onehi Momoh", "Sidney Momoh", "Shayann Alvero", "Additional Guest 1"],
  22: ["Grâce Ndonga", "Mickaël Ribeiro", "Laurie-Anne Ribeiro", "Arcange Ntokua", "David Cairaschi", "Daniel joseph", "Valerie Joseph", "Elina Joseph", "Adrienne Mbangu", "Dias Ntokua"],
  23: ["Elda Makuntima", "Miguel Bemvindo", "Josly Nuamosi-Mbambu", "Erwann Kadina", "Khezia Miakukila", "Tsippora Miakukila", "Henriette Muzezenu", "Jerode Muzezenu", "Lizéa Mbila", "Mélina Kiangala"],
  24: ["Sevrine Lotisi", "Isaac Lotisi", "Rosie Unzitisa", "Sebastien Unzitisa", "Koffi Bolamba", "Rosette Bolamba", "Lily Nuamosi", "José Nuamosi", "Josian Nuamosi", "Joan Nuamosi"],
  25: ["Odette Muzezenu", "Jerry Muzezenu", "Serge Mbiki", "Mifi Mbiki", "Alain Nsakala", "Anita Nsakala", "Chantale Muzezenu", "Jerry Junior Muzezenu", "Etienne Mawete Makinu", "Maguy Mawete Makinu"],
  26: ["Anne Fuema", "Jonathan Kumbi", null, "Mika Fleurival", "Jean-Clivens Le Caous", "Dan Elenga", "Cedrik LeCaous", "Cédric Tyller BELINGA", "Dylan Lorsold", "Maeva Lorsold", "Maman Sunette Jean-Baptiste"],
  27: [null, null, "Mademoissele Isokolele", null, "Frank Mbonda", "Sami Simon", "Jovany Germain", "Momo Sidibe", "Naomi SHANGO", "Vanilla TJOM", "Karl Isolokele", "amie de Naomi"],
  28: [null, null, "Celestina Mundanda Nsita", null, "Nicole Mbangu", "Niveline Mbangu", "Pauliana Mundanda Nsita", "Tressy Mundanda Nsita", "Paul Mundanda Nsita", "Renense Mundanda Nsita", "Amy Eiano", "Accompagnant non-nommé", "Accompagnant non-nommé"],
  29: ["Sergio Manuel", "Babel Nzasi", "Prince Nzasi", "Laura Humba", null, "Divine Simao", "Dorcas Matembe", "Enfant Nsasi", null, null, "Accompagnant non-nommé"],
  30: ["Sem Landu", "Dorine Landu", "Roger Landu", "Nadine Landu", "Richard Landu", "Denise Landu", "Rémy Landu", "Betty Jeanne Closse", "Lucien Closse", null],
  31: [null, "Odette Manuel", "Nadine Kimbau", "Debest Pello", "Claudine Pello", "Steven Kimbau", "Antoinette Kimbau", "Cady Belida", "Marleine Bansimba", "Laetitia Bongo", "Youyou Lembe Tchiteya"],
  32: ["Lucie Nzuzi", "Seba Domingos", "Clavert Domingos", "Accompagnant non-nommé", null, null, "Guillaume Mayimakanda", "Yves ELIMA", "Charlene ELIMA", "Maman Elima"],
  33: ["Isabel Ferreira", "Makaia Vemba Ferreira", "Esmeralda Vemba", "KENAYA MAMBAKASA", "Plamedi Okito", "Darleine Okito", null, "Estelle Okito", "KHEIRA MAMBAKASA", "ANNE KAYLEE MAMBAKASA", "Emilia Mbidi"],
  34: ["Eden Lopez", "Veronique Nsenda", "Jean-Claude Nsenda", "Noel Nsenda", "Gladys Lopez", "Martinette Lopez", "Ruben Lopez", "Augustin Nsenda", "Aurelie Nsenda", "Moise Nsenda"],
  35: ["Clement Luvuasi", "Maguy Luvuasi", "Brady Landu", "Victoria Landu", "Dylan Landu", "Allegria Mpilingi", "Geodray Luvuasi", "Kamal Bekka", "Marta Bekka", "Ines Bekka"],
  36: ["Joeliane Elmacin", "Riffick Saviera", "Mercia Saviera", "Eude Matondo", "Bob Culumbu", "Lumbu Mabanza Joël", "Huguette Matondo", "Francisco Matondo", "Julianna Matondo", "Luzolo Patrick Menga"],
  37: ["Fatou Diaby", "Bangaly Souare", "Denise Nkoussou", "Jean Mbila", "Cécile Mbila", "Jean-Claude Onokoko", "Thomas Wandubula", "Yannick Abdoul Camara", "Tiphaine Abdoul Camara", null],
  38: ["Jennifer Bembo", "Jacquie Menga", "Lambert Menga", "Joël Bembo", "Bana Menga", null, "Nadia Mabata", "Accompagnant non-nommé", null, null],
  39: ["Barnabe Shungu", "Ahicam Damuna", "Priscile Makuntima", "Daeve Landu", "Jeanne Tona", "Helène Tona", "Léna Vinelle Nganga", "Lucien Shampe", "Isidore Luyindula", "Glody Kambwa"],
  40: [null, null, null, null, "Michaud Culumbu", null, null, "Simao Guilherme", "Michelina Guilherme", null, "Femme Michaud"],
  41: [null, null, null, null, null, null, null, null, null, null],
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
