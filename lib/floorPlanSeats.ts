// Noms de sieges extraits DIRECTEMENT du PDF seatplan.io final (export texte
// vectoriel, pas une photo -- aucune lecture OCR approximative), transmis par
// Gersom le 06/10/2026 ("seating-chart-Mariage-Nelly---Gege-2026-10-06_1.pdf").
// PUREMENT INFORMATIF -- ce n'est PAS la source de placement de l'application
// (qui reste invitations.table_id, seule source ecrite/autoritative, cf.
// docs/DATA_CHANGE_INSTRUCTIONS.md section 6). Sert uniquement a afficher, a
// titre indicatif, qui la famille avait prevu de faire asseoir a cette table
// au moment de l'export -- jamais ecrit en base, jamais utilise pour decider
// une assignation. Ordre des sieges : angle exact de chaque etiquette autour
// du centre de la table (extrait du PDF via PyMuPDF, pas une estimation).
// `null` = siege vide sur ce PDF, ou aucune correspondance fiable trouvee.
//
// Methode (v1.68.2, remplace entierement les donnees v1.68.1 -- le plan de
// table a ete redessine entre le 04/10 et le 06/10/2026, retour de Gersom :
// "disposition of table have changed... I will do it manually and redo") : le
// PDF est un document vectoriel (seatplan.io), son texte et les coordonnees
// de chaque etiquette sont extraits directement -- fiabilite totale sur
// l'orthographe lue, contrairement a l'OCR. Chaque nom est ensuite recoupe
// avec les membres reellement places en base (apres la mise a jour groupee de
// ce lot, confirmee par Gersom) pour reprendre l'orthographe canonique de
// l'application. Fait notable : ce PDF (comme le nouveau guest-list_58.csv)
// ne montre plus aucune "table 1" -- ses anciens occupants sont desormais
// repartis sur d'autres tables (8, 11, 33, 36...), signale a Gersom plutot
// que devine (voir CHANGELOG) ; la table 1 garde une entree ici (10 sieges
// vides) faute de donnee source. Quelques seances du PDF divergent du CSV sur
// quelques sieges isoles (ex. "Luzolo P. Menga" dessine a la table 31 sur le
// PDF, mais tagge T036 dans le CSV) -- le CSV fait toujours foi pour le vrai
// placement (invitations.table_id), ce panneau reste simplement `null` sur
// ces quelques sieges plutot que de refleter une donnee qui contredirait la
// vraie table de la personne.
//
// v1.71.0 (07/10/2026, export « seating-chart ... (7).pdf » + guest-list (63).csv) :
// table 42 retiree (desactivee, voir migration 0064) ; « Roger Makongo »
// ajoute au 10e siege de la table 30 (nouvel invite, CSV T030) ;
// « Luzolo Patrick Menga » desormais a la table 31 en base aussi (CSV T031,
// deplace depuis la table 36 par la migration 0064) -- son siege n'est plus
// vide. Les autres tables, recomparees nom par nom avec ce PDF, sont
// inchangees.
export const TABLE_SEAT_NAMES: Record<number, (string | null)[]> = {
  // v1.71.0 : table 1 « Maquela do Zombo » = reserve excedentaire, vide.
  1: [null, null, null, null, null, null, null, null, null, null],
  2: ["Erika Dos Goncalves", "Mona Vemba", "Isabel Vemba", "Maguy Malungu", "Ruben Kinanga Malungu", "Luis Dos", "Gaby Dos", "DeMbala Dos Goncalves", "Jael Dos Goncalves", "Nsimba Mambakasa"],
  3: ["Leverry Kinzi", "Jonas Mpindi", "Henry Kiadi Ndiongo", "Sumali Ndiongo", "Diton Kiala Diamena", "Oredezo Blancky", "Costa Mvovi", null, "Edo Tukula", "Neves Kiombi Nzuzi"],
  4: ["Henri Onatshungu Momba", "Henriela Onatshungu Momba", "Thierry Mbiyavanga Mavinga", "Dorothée Deborah Nsingani", "Staicy Mbiyavanga Mavinga", "Kelcy Mbiyavanga Mavinga", "Jessy Buka Mbiyavanga Mavinga", "Taylor Mbiyavanga Mavinga", "Fiston Zola", "Michela Teka sanda"],
  5: ["Maria Mputuilu", "Graça Inacio", "Andre Neves", "Chantal Neves", "Papa David Lukau", "Maman Josefina Lukau", "David-Junior Lukau", "Eutyche Lukau", "Elisa Jean", "Alfred Jean"],
  6: ["Helder Vemba", "Kupesa Lando Ferreira", "Eugenia Sengo chipala", "Destino Mbulu Esamba", "Tchecka Mbulu", "Adriano Vemba", "Merveille Makaya", "Emilia Mbidi", null, "Papy Mamona"],
  7: [null, "Nedy Simao", "Jessiline Mateus", "Filho 3 Culumbu", "Filho 1 Culumbu", "Filho 4 Culumbu", "Filho 5 Culumbu", "Femme Culumbu", "Tio Gilie Culumbu", "Julianna Matondo"],
  8: ["Mahjo Yezi", null, "Seda Tahan", "Sarah Tahan", "Odette Culumbu", "Adriana Tsita", "Julie Indanda", "Hadelin Yezi", "Deborah Yezi", "Celestina Yezi"],
  9: ["Lotine André", "Andre Nsiangangu", "Femme Nsiangangu", "Enfant Nsiangangu", "Maurice Ndani Ndoba", "Keyris Ndani", "Giresse Juliano Nzengo", "Grace Tshisungu", "Mamita Ndani"],
  10: ["Rose-marie Kumba", "Qeren Moba-Mbemba", "Naomie Ghansi", "Kevin GHANSI", "Josué Ghansi", "Fyra Biyoudi", "Chindelle Moba-Mbemba", "Christelle Lema", "Eric Lema", "Stephanie Buluka mituele"],
  11: ["Loïc Neves", "Gloire André", "Gabriel Skoty Sanda", "Andrea Neves", "Jonathan Ndani", "Bontee Tercia Ndani", "Ketsia Neves", "Teresa Ndani", "Diego Ramos", "Zoya Inacio"],
  12: ["Louise Ngonda Nsenga", "Nana Mabumba", "Felix Luboya", "Tatiana Bitumazala", "Diane Eberhorn", "Yvon Bitumazala", "Rose Bulisi", "Joana Lusuena", "Fifi Lusuena", "Sylvie Bulisi"],
  13: ["Mona Guygson Vemba", "GISELE MAMBAKASA", "BIJOU MAMBAKASA", "Simon Mbidi", "Suzie Vemba", "Rolly Makaya Mvemba", null, "Johny Kiala", "Abeti Okito", "Johny Okito"],
  14: ["Dorcas Massamba", "Hugo Massamba", "Imeon Massamba", "Ludovic Eckomband", "Sita Muzemba", "Stephenson Bulaki", "Gaelle Bulaki", "Carl Aye", "Enricka Aye", "Jordy Ungeli"],
  15: ["Babel Nzasi", "Alonso Isey (Godard)", "Bana Tia Sonia", "Anjo Ditutala", "Bana Tia Sonia", null, "Acacia Nsasi", "Milda Nzasi", "Arcanjo Nzasi", "Prince Nzasi"],
  16: ["Yeze Zinga", "Sephora Tulomba", "Jessica Tulomba", "Silva Mvuemba", "Melissa Mvuemba", "Yomo Formosa", "Olivier Benga", "Denzu Laisana", "Djessus Steano Tulomba"],
  17: ["Joelis Jean", "Jeremie Luyindula", "Lynda Luyindula", "Gloria Luyindula", "Manuela Zerrougui", "Raffik Zerrougui", "Aimé Luyindula", "Prémices Jean", "Déborah Brigitte", "Jessica Jean"],
  18: ["Melanie Matuba", "Bernard Kadina", "Sylvie Kadina", "Regine Nkoyi", "Victor Nkoyi", "Marie-Chantal Kiangala", "Graca Lorena Gomes", "Zola Martine Gomes", "Maria Irène Gomes", "Furty Matuba"],
  19: ["Ben Messan", "Anais Messan", "Benson Messan", "Adeline Makopa", "Kemal Makiese", "Michèle Isolonge", "Christine Kaseka", "Bionic Kileki", "Tryphène Kileki", "Vicky Nsumbu Mvuza"],
  20: ["Felicia Ndedi", "Prosper Chi Nche", "Dany Dasilva", "Carine Sagbo", "Divine Masiala", "Awa Kamate", "Souleyman Gassama", "Ghislain Mayemba", "Charlene Coulibaly", "Sylviane Jeanne"],
  21: ["Line Kwatchou", "Additional Guest 1", "Sidney Momoh", "Onehi Momoh", "Silyann Bitouloulou", "Maman Pitchou Alvero", "Papa Sam Alvero", "Sam jr. Alvero", "Shayann Alvero", "Nolivia Bitsindou"],
  22: ["Laurie-Anne Ribeiro", "Arcange Ntokua", "Dias Ntokua", "Adrienne Mbangu", "Elina Joseph", "Valerie Joseph", "Daniel joseph", "Charlotte Secke", "Zachée Secke", "Mickaël Ribeiro"],
  23: ["Josly Nuamosi-Mbambu", "Mélina Kiangala", "Lizéa Mbila", "Jerode Muzezenu", "Henriette Muzezenu", "Tsippora Miakukila", "Khezia Miakukila", "Erwann Kadina", "Helda Makuntima", "Miguel Bemvindo"],
  24: ["Rosie Unzitisa", "Sebastien Unzitisa", "Lily Nuamosi", "José Nuamosi", "Josian Nuamosi", "Joan Nuamosi", "Rosette Bolamba", "Koffi Bolamba", "Sevrine Lotisi", "Isaac Lotisi"],
  25: ["Jerry Muzezenu", "Chantale Muzezenu", "Jerry Junior Muzezenu", "Maguy Mawete Makinu", "Alain Nsakala", "Anita Nsakala", "Mifi Mbiki", "Serge Mbiki", "Etienne Mawete Makinu", "Odette Muzezenu"],
  26: ["Wytney Da Veiga", "Jean-Clivens Le Caous", "Cedrik LeCaous", "Maeva Lorsold", "Dylan Lorsold", "Cédric Tyller BELINGA", "Dan Elenga", "Mika Fleurival", "Anne Fuema", "Jonathan Kumbi"],
  27: ["Karl Isolokele", "Mademoissele Isokolele", "Frank Mbonda", "Sami Simon", "Jovany Germain", "Momo Sidibe", "Naomi SHANGO", "Vanilla TJOM", "Alyson Choy", "Kai Choy"],
  28: ["Maguy Celestina Mundanda Nsita", "Paul Mundanda Nsita", "Renense Mundanda Nsita", "Tressy Mundanda Nsita", "Pauliana Mundanda Nsita", "Niveline Mbangu", "Nicole Mbangu", "Accompagnateur Amy Eliano", "Accompagnateur Amy Eliano", "Roger (Amy Eliano) Culumbu"],
  29: ["Laura Humba", null, "Weplo Culumbu", "Sylvie Culumbu", "Nicole Tusevo", "Elvis Tusevo", "Safira Tusevo", "Dorcas Matembe", "Divine Simao", "Sergio Manuel"],
  30: ["Richard Landu", "Betty Jeanne Closse", "Lucien Closse", "Roger Landu", "Nadine Landu", "Dorine Landu", "Sem Landu", "Denise Landu", "Rémy Landu", "Roger Makongo"],
  31: ["Nadine Kimbau", "Debest Pello", "Claudine Pello", "Luzolo Patrick Menga", "Antoinette Kimbau", "Cady Belida", "Marleine Bansimba", "Laetitia Bongo", "Youyou Lembe Tchiteya", "Odette Manuel"],
  32: ["Maman Elima", "Guillaume Mayimakanda", "Lucie Nzuzi", null, "Seba Domingos", "Clavert Domingos", "Charlene ELIMA", "Yves ELIMA", "Keren Malungu", "Keziah Malungu"],
  33: ["Esmeralda Vemba", "Plamedi Okito", "Darleine Okito", "Estelle Okito", "ANNE KAYLEE MAMBAKASA", "KHEIRA MAMBAKASA", "Domingas Ferreira", "Isabel Ferreira", "KENAYA MAMBAKASA", "Makaia Vemba Ferreira"],
  34: ["Jean-Claude Nsenda", "Noel Nsenda", "Moise Nsenda", "Aurelie Nsenda", "Augustin Nsenda", "Ruben Lopez", "Martinette Lopez", "Gladys Lopez", "Eden Lopez", "Veronique Nsenda"],
  35: ["Clement Luvuasi", "Maguy Luvuasi", "Kamal Bekka", null, "Denis Beijinho", "Kizombeira DelaVille", "Dede DelaVille", "Marta Bekka", "Ines Bekka", "Geodray Luvuasi"],
  36: ["Joeliane Elmacin", "Lumbu Mabanza Joël", "Herve Menga", "Eude Matondo", "Francisco Matondo", "Huguette Matondo", "Tuzola SAVIERA", "Riffick Saviera", "Keith Saviera", "Mercia Saviera"],
  37: ["Bangaly Souare", "Yannick Abdoul Camara", "Tiphaine Abdoul Camara", "Thomas Wandubula", "Jean-Claude Onokoko", "Cécile Mbila", "Jean Mbila", "Denise Nkoussou", "David Cairaschi", "Fatou Diaby"],
  38: ["Lambert Menga", "Bana Menga", "Bana Menga", "Accompagnant non-nommé", "Accompagnant non-nommé", "Accompagnant non-nommé", "Nadia Mabata", "Joël Bembo", "Jennifer Bembo", "Jacquie Menga"],
  39: ["Priscile Makuntima", "Barnabe Shungu", "Isidore Luyindula", "Glody Kambwa", "Lucien Shampe", "Léna Vinelle Nganga", "Jeanne Tona", "Helène Tona", "Ahicam Damuna"],
  40: ["Gisele Bopima", "Michaud Mabata", "Edoly Lukoki", "Michelina Guilherme", "Simao Guilherme", "Raphael Da Silva", "Daryl Lukoki", "Gladys Lukoki", "Dany Lukoki", "Glavina Lukoki"],
  // v1.72.0 : table 42 = seconde reserve excedentaire, vide.
  42: [null, null, null, null, null, null, null, null, null, null],
  41: ["Allegria Mpilingi", "Lys Landu", "Maeva Pierrefite", "Greg Pierrefitte", "Julia Pierrefite", "Axel Tacita", "Daeve Landu", "Brady Landu", "Dylan Landu", "Victoria Landu"],
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
