// Noms de sieges extraits DIRECTEMENT du PDF seatplan.io final (export texte
// vectoriel, pas une photo -- aucune lecture OCR approximative), transmis par
// Gersom le 05/10/2026 ("seating-chart-Mariage-Nelly---Gege-2026-10-04_3.pdf",
// 44 "tables" seatplan.io = 41 tables numerotees + Table Mariés + Table DJ +
// No Table Staff). PUREMENT INFORMATIF -- ce n'est PAS la source de placement
// de l'application (qui reste invitations.table_id, seule source
// ecrite/autoritative, cf. docs/DATA_CHANGE_INSTRUCTIONS.md section 6). Sert
// uniquement a afficher, a titre indicatif, qui la famille avait prevu de
// faire asseoir a cette table au moment de l'export -- jamais ecrit en base,
// jamais utilise pour decider une assignation. Ordre des sieges : angle
// exact de chaque etiquette autour du centre de la table (extrait du PDF via
// PyMuPDF, pas une estimation). `null` = siege vide sur ce PDF.
//
// Methode (v1.68.1, remplace entierement les donnees v1.68.0 -- obtenues par
// OCR de 4 photos de zones, nettement moins fiable) : le PDF est un document
// vectoriel (seatplan.io), son texte et les coordonnees de chaque etiquette
// sont extraits directement (aucune reconnaissance d'image necessaire) --
// fiabilite totale sur l'orthographe lue, contrairement a l'OCR. Chaque nom
// est ensuite recoupe avec les membres reellement places en base (apres la
// mise a jour groupee de ce lot) pour reprendre l'orthographe canonique de
// l'application plutot que l'abreviation parfois utilisee par seatplan.io
// (ex. "Henri O. Momba" -> "Henri Onatshungu Momba"). Quand aucune
// correspondance fiable n'est trouvee (personne non encore presente en base,
// ou nom generique "Accompagnant non-nomme"), le texte du PDF est conserve
// tel quel (nettoye des troncatures d'affichage) plutot que devine.
export const TABLE_SEAT_NAMES: Record<number, (string | null)[]> = {
  1: ["Hadelin Yezi", "Deborah Yezi", "Domingas Ferreira", "Erika Dos Goncalves", "Lys Landu", "Ketsia Neves", "Eutyche Lukau", "David-Junior Lukau", "Teresa Ndani", "Herve Menga"],
  2: ["Jael Dos Goncalves", "Keith Saviera", "Tuzola SAVIERA", "Isabel Vemba", "Mona Vemba", "Luis Dos", "Gaby Dos", "Maguy Malungu", "Ruben Kinanga Malungu", "DeMbala Dos Goncalves"],
  3: ["Leverry Kinzi", "Jonas Mpindi", "Henry Kiadi Ndiongo", "Sumali Ndiongo", "Diton Kiala Diamena", "Oredezo Blancky", "Costa Mvovi", "Epouse Mvovi", "Edo Tukula", "Neves Kiombi Nzuzi"],
  4: ["Henri Onatshungu Momba", "Henriela Onatshungu Momba", "Thierry Mbiyavanga Mavinga", "Dorothée Deborah Nsingani", "Staicy Mbiyavanga Mavinga", "Kelcy Mbiyavanga Mavinga", "Jessy Buka Mbiyavanga Mavinga", "Taylor Mbiyavanga Mavinga", "Fiston Zola", "Michela Teka sanda"],
  5: ["Maria Mputuilu", "Graça Inacio", "Andre Neves", "Chantal Neves", "Papa David Lukau", "Maman Josefina Lukau", "Edouard Kiaku Mbuta", "femme edo kiaku mbuta", "Elisa Jean", "Alfred Jean"],
  6: ["Helder Vemba", "Kupesa Lando Ferreira", "Eugenia Sengo chipala", "Mbulu Esamba", "Tchecka Mbulu", "Papy Mamona", "Adriano Vemba", "Merveille Makaya", "Pajos Mpapa", "Nsimba Mambakasa"],
  7: ["Safira Tusevo", "Elvis Tusevo", "Nicole Tusevo", "Tio Gilie Culumbu", "Filho 4 Culumbu", "Femme Culumbu", "Jessiline Mateus", "Filho 3 Culumbu", "Filho 5 Culumbu", "Filho 1 Culumbu"],
  8: ["Celestina Yezi", "Sarah Tahan", "Seda Tahan", "Odette Culumbu", "Darliane Mpiassa", "Sylvia Mpiassa", "Ya Lale Yezi", "Julie Indanda", "Adriana Tsita", "Mahjo Yezi"],
  9: ["Lotine André", "Andre Nsiangangu", "Femme Nsiangangu", "Enfant Nsiangangu", "Maurice Ndani Ndoba", "Keyris Ndani", "Giresse Juliano Nzengo", "Grace Tshisungu", "Mamita Ndani", null],
  10: ["Rose-marie Kumba", "Qeren Moba-Mbemba", "Naomie Ghansi", "Kevin GHANSI", "Josué Ghansi", "Fyra Biyoudi", "Chindelle Moba-Mbemba", "Christelle Lema", "Eric Lema", "Stephanie Buluka mituele"],
  11: ["Loïc Neves", "Gloire André", "Gabriel Skoty Sanda", "Andrea Neves", "Jonathan Ndani", "Bontee Tercia Ndani", "Diego Ramos", "Zoya Inacio", null, null],
  12: ["Louise Ngonda Nsenga", "Nana Mabumba", "Felix Luboya", "Tatiana Bitumazala", "Diane Eberhorn", "Yvon Bitumazala", "Rose Bulisi", "Joana Lusuena", "Fifi Lusuena", "Sylvie Bulisi"],
  13: ["Mona Guygson Vemba", "GISELE MAMBAKASA", "BIJOU MAMBAKASA", "Suzie Vemba", "Simon Mbidi", "Danyl Mbidi", "Rolly Makaya Mvemba", "Johny Kiala", "Abeti Okito", "Johny Okito"],
  14: ["Dorcas Massamba", "Hugo Massamba", "Imeon Massamba", "Ludovic Eckomband", "Sita Muzemba", "Stephenson Bulaki", "Gaelle Bulaki", "Carl Aye", "Enricka Aye", "Jordy Ungeli"],
  15: ["Sylvie Weplo", "Alonso Isey (Godard)", "Tia Sonia Culumbu", "Anjo Ditutala", "Tia Sonia Culumbu", "Bana t. S. 2", "Rafael O. I. Ngalula", "Weplo Antoine", null, null],
  16: ["Yeze Zinga", "Sephora Tulomba", "Jessica Tulomba", "Silva Mvuemba", "Melissa Mvuemba", "Yomo Formosa", "Olivier Benga", "Denzu Laisana", "Djessus Steano Tulomba", null],
  17: ["Joelis Jean", "Jeremie Luyindula", "Lynda Luyindula", "Gloria Luyindula", "Manuela Zerrougui", "Raffik Zerrougui", "Aimé Luyindula", "Prémices Jean", "Déborah Brigitte", "Jessica Jean"],
  18: ["Melanie Matuba", "Bernard Kadina", "Sylvie Kadina", "Regine Nkoyi", "Victor Nkoyi", "Marie-Chantal Kiangala", "Graca Lorena Gomes", "Zola Martine Gomes", "Maria Irène Gomes", "Furty Matuba"],
  19: ["Ben Messan", "Anais Messan", "Benson Messan", "Adeline Makopa", "Kemal Makiese", "Michèle Isolonge", "Christine Kaseka", "Bionic Kileki", "Tryphène Kileki", "Vicky Nsumbu Mvuza"],
  20: ["Felicia Ndedi", "Prosper Chi Nche", "Dany Dasilva", "Carine Sagbo", "Divine Masiala", "Awa Kamate", "Souleyman Gassama", "Ghislain Mayemba", "Charlene Coulibaly", "Sylviane Jeanne"],
  21: ["Line Kwatchou", "Additional Guest 1", "Sidney Momoh", "Onehi Momoh", "Silyann Bitouloulou", "Maman Pitchou Alvero", "Papa Sam Alvero", "Sam jr. Alvero", "Shayann Alvero", "Nolivia Bitsindou"],
  22: ["Laurie-Anne Ribeiro", "Arcange Ntokua", "Dias Ntokua", "Adrienne Mbangu", "Elina Joseph", "Valerie Joseph", "Daniel joseph", "David Cairaschi", "Grâce Ndonga", "Mickaël Ribeiro"],
  23: ["Josly Nuamosi-Mbambu", "Mélina Kiangala", "Lizéa Mbila", "Jerode Muzezenu", "Henriette Muzezenu", "Tsippora Miakukila", "Khezia Miakukila", "Erwann Kadina", "Elda Makuntima", "Miguel Bemvindo"],
  24: ["Rosie Unzitisa", "Sebastien Unzitisa", "Lily Nuamosi", "José Nuamosi", "Josian Nuamosi", "Joan Nuamosi", "Rosette Bolamba", "Koffi Bolamba", "Sevrine Lotisi", "Isaac Lotisi"],
  25: ["Jerry Muzezenu", "Chantale Muzezenu", "Jerry Junior Muzezenu", "Maguy Mawete Makinu", "Alain Nsakala", "Anita Nsakala", "Mifi Mbiki", "Serge Mbiki", "Etienne Mawete Makinu", "Odette Muzezenu"],
  26: ["Witney Da Veiga", "Jean-Clivens Le Caous", "Cedrik LeCaous", "Maeva Lorsold", "Dylan Lorsold", "Cédric Tyller BELINGA", "Dan Elenga", "Mika Fleurival", "Anne Fuema", "Jonathan Kumbi"],
  27: ["Karl Isolokele", "Mademoissele Isokolele", "Frank Mbonda", "Sami Simon", "Jovany Germain", "Momo Sidibe", "Naomi SHANGO", "Vanilla TJOM", "Alyson Kai", "Kai Choy"],
  28: ["Celestina Mundanda Nsita", "Paul Mundanda Nsita", "Renense Mundanda Nsita", "Tressy Mundanda Nsita", "Pauliana Mundanda Nsita", "Niveline Mbangu", "Nicole Mbangu", "Accompagnant Eliano", "Accompagnant Eliano", "Roger C. (Eliano)"],
  29: ["Prince Nzasi", "Arcanjo Nzasi", "Milda Nzasi", "Acacia Nzasi", "VIP 1", "Dorcas Matembe", "Divine Simao", "Laura Humba", "Sergio Manuel", "Babel Nzasi"],
  30: ["Dorine Landu", "Roger Landu", "Nadine Landu", "Richard Landu", "Denise Landu", "Rémy Landu", "Betty Jeanne Closse", "Lucien Closse", "Axel Tacita", "Sem Landu"],
  31: ["Nadine Kimbau", "Debest Pello", "Claudine Pello", "Steven Kimbau", "Antoinette Kimbau", "Cady Belida", "Marleine Bansimba", "Laetitia Bongo", "Youyou Lembe Tchiteya", "Odette Manuel"],
  32: ["Clavert Domingos", "Accompagnant non-nommé", "Sister 2 Malungu", "Keziah Malungu", "Guillaume Mayimakanda", "Yves ELIMA", "Charlene ELIMA", "Maman Elima", "Lucie Nzuzi", "Seba Domingos"],
  33: ["Esmeralda Vemba", "Plamedi Okito", "Darleine Okito", "Estelle Okito", "ANNE KAYLEE MAMBAKASA", "KHEIRA MAMBAKASA", "Emilia Mbidi", "KENAYA MAMBAKASA", "Isabel Ferreira", "Makaia Vemba Ferreira"],
  34: ["Jean-Claude Nsenda", "Noel Nsenda", "Moise Nsenda", "Aurelie Nsenda", "Augustin Nsenda", "Ruben Lopez", "Martinette Lopez", "Gladys Lopez", "Eden Lopez", "Veronique Nsenda"],
  35: ["Brady Landu", "Victoria Landu", "Kamal Bekka", "Marta Bekka", "Ines Bekka", "Geodray Luvuasi", "Allegria Mpilingi", "Dylan Landu", "Clement Luvuasi", "Maguy Luvuasi"],
  36: ["Julianna Matondo", "Huguette Matondo", "Francisco Matondo", "Luzolo Patrick Menga", "Milo Bob Mabata", "Eude Matondo", "Mercia Saviera", "Riffick Saviera", "Joeliane Elmacin", "Lumbu Mabanza Joël"],
  37: ["Bangaly Souare", "Yannick Abdoul Camara", "Tiphaine Abdoul Camara", "Thomas Wandubula", "Jean-Claude Onokoko", "Cécile Mbila", "Jean Mbila", "Denise Nkoussou", "Fatou Diaby", null],
  38: ["Lambert Menga", "Bana Menga", "Bana Menga", "Accompagnant non-nommé", "Accompagnant non-nommé", "Accompagnant non-nommé", "Nadia Mabata", "Joël Bembo", "Jennifer Bembo", "Jacquie Menga"],
  39: ["Priscile Makuntima", "Daeve Landu", "Isidore Luyindula", "Glody Kambwa", "Lucien Shampe", "Léna Vinelle Nganga", "Jeanne Tona", "Helène Tona", "Barnabe Shungu", "Ahicam Damuna"],
  40: ["Gisele Bopima", "Michaud Mabata", "Edoly Lukoki", "Michelina Guilherme", "Simao Guilherme", "Raphael Da Silva", "Daryl Lukoki", "Gladys Lukoki", "Dany Lukoki", "Glavina Lukoki"],
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
