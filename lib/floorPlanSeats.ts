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
// v1.79.2 (11/10/2026, export « seating-chart ... 2026-10-10_3.pdf » +
// guest-list_67.csv) : reconstruit entierement depuis ce PDF (ordre des
// sieges depuis le haut, sens horaire) avec l'orthographe de l'application
// apres les migrations 0072 et 0073. Chaque siege nomme du plan correspond a une
// personne placee a la meme table dans l'application.
// v1.80.0 (11/10/2026, name-tags + seating-chart du 10/10 (4) + guest-list_68.csv) :
// tables 2, 8, 31, 32, 36, 38 et 40 reprises du plan (siege N = case N-2, verifie
// sur 378 sieges) -- Luis/Gaby Dos Goncalves, Mabata nommes (Sofiane, Mernad,
// Diklavin a la 38, Merline a la 40), Edoly Lukoki retiree, Eude Matondo (31) et
// Luzolo Patrick Menga (36) echanges ; table 39 remise a 10 cases (une manquait).
export const TABLE_SEAT_NAMES: Record<number, (string | null)[]> = {
  // Tables 1 et 42 : reserves excedentaires, vides sur le plan.
  1: [null, null, null, null, null, null, null, null, null, null],
  2: ["Erika Dos Goncalves", "Maguy Malungu", "Ruben Kinanga Malungu", "Mona Vemba", "Isabel Vemba", "Gaby Dos Goncalves", "Luis Dos Goncalves", "DeMbala Dos Goncalves", "Jael Dos Goncalves", "Nsimba Mambakasa"],
  3: ["Leverry Kinzi", "Jonas Mpindi", "Henry Kiadi Ndiongo", "Sumali Ndiongo", "Diton Kiala Diamena", "Oredezo Blancky", "Costa Mvovi", "Maman Mvovi", "Edo Tukula", "Neves Kiombi Nzuzi"],
  4: ["Henri Onatshungu Momba", "Henriela Onatshungu Momba", "Thierry Mbiyavanga Mavinga", "Dorothée Deborah Nsingani", "Staicy Mbiyavanga Mavinga", "Kelcy Mbiyavanga Mavinga", "Jessy Buka Mbiyavanga Mavinga", "Taylor Mbiyavanga Mavinga", "Fiston Zola", "Michela Teka sanda"],
  5: ["Maria Mputuilu", "Graça Inacio", "Andre Neves", "Chantal Neves", "Papa David Lukau", "Maman Josefina Lukau", "David-Junior Lukau", "Eutyche Lukau", "Elisa Jean", "Alfred Jean"],
  6: ["Helder Vemba", "Kupesa Lando Ferreira", "Eugenia Sengo chipala", "Destino Mbulu Esamba", "Tchecka Mbulu", "Adriano Vemba", "Merveille Makaya", "Emilia Mbidi", "Danyl Mbidi", "Papy Mamona"],
  7: ["Bob Culumbu", "Nedy Simao", "Jessiline Mateus", "Filho 1 Culumbu", "Filho 3 Culumbu", "Filho 4 Culumbu", "Filho 5 Culumbu", "Femme Culumbu", "Tio Gilie Culumbu", "Julianna Matondo"],
  8: ["Mahjo Yezi", "Adriana Tsita", "Seda Tahan", "Sarah Tahan", "Hadelin Yezi", "Deborah Yezi", "Odette Culumbu", "Ya Lale Culumbu", "Tata Julie Indanda", "Celestina Yezi"],
  9: ["Lotine André", "Andre Nsiangangu", "Femme Nsiangangu", "Enfant Nsiangangu", "Maurice Ndani Ndoba", "Keyris Ndani", "Giresse Juliano Nzengo", "Grace Tshisungu", null, "Mamita Ndani"],
  10: ["Rose-marie Kumba", "Qeren Moba-Mbemba", "Naomie Ghansi", "Kevin GHANSI", "Josué Ghansi", "Fyra Biyoudi", "Chindelle Moba-Mbemba", "Christelle Lema", "Eric Lema", "Stephanie Buluka mituele"],
  11: ["Loïc Neves", "Gloire André", "Gabriel Skoty Sanda", "Andrea Neves", "Jonathan Ndani", "Bontee Tercia Ndani", "Ketsia Neves", "Teresa Ndani", "Diego Ramos", "Zoya Inacio"],
  12: ["Louise Ngonda Nsenga", "Nana Mabumba", "Felix Luboya", "Tatiana Bitumazala", "Diane Eberhorn", "Yvon Bitumazala", "Rose Bulisi", "Joana Lusuena", "Fifi Lusuena", "Sylvie Bulisi"],
  13: ["Mona Guygson Vemba", "GISELE MAMBAKASA", "BIJOU MAMBAKASA", "Simon Mbidi", "Suzie Vemba", "Rolly Makaya Mvemba", "Pajos Mpapa", "Johny Kiala", "Abeti Okito", "Johny Okito"],
  14: ["Dorcas Massamba", "Hugo Massamba", "Imeon Massamba", "Ludovic Eckomband", "Sita Muzemba", "Stephenson Bulaki", "Gaelle Bulaki", "Carl Aye", "Enricka Aye", "Jordy Ungeli"],
  15: ["Babel Nzasi", "Alonso Isey (Godard)", "Sonia Ditutala", "Anjo Ditutala", "Bana Tia Sonia", "Bana Tia Sonia", "Acacia Nzasi", "Milda Nzasi", "Arcanjo Nzasi", "Prince Nzasi"],
  16: ["Yeze Zinga", "Sephora Tulomba", "Jessica Tulomba", "Silva Mvuemba", "Melissa Mvuemba", "Yomo Formosa", null, "Olivier Benga", "Denzu Laisana", "Djessus Steano Tulomba"],
  17: ["Joelis Jean", "Jeremie Luyindula", "Lynda Luyindula", "Gloria Luyindula", "Manuela Zerrougui", "Raffik Zerrougui", "Aimé Luyindula", "Prémices Jean", "Déborah Brigitte", "Jessica Jean"],
  18: ["Melanie Matuba", "Bernard Kadina", "Sylvie Kadina", "Regine Nkoyi", "Victor Nkoyi", "Marie-Chantal Kiangala", "Graca Lorena Gomes", "Zola Martine Gomes", "Maria Irène Gomes", "Furty Matuba"],
  19: ["Ben Messan", "Anais Messan", "Benson Messan", "Adeline Makopa", "Kemal Makiese", "Michèle Isolonge", "Christine Kaseka", "Bionic Kileki", "Tryphène Kileki", "Vicky Nsumbu Mvuza"],
  20: ["Felicia Ndedi", "Prosper Chi Nche", "Dany Dasilva", "Carine Sagbo", "Divine Masiala", "Awa Kamate", "Souleyman Gassama", "Ghislain Mayemba", "Charlene Coulibaly", "Sylviane Jeanne"],
  21: ["Line Kwatchou", "Additional Guest 1", "Sidney Momoh", "Onehi Momoh", "Silyann Bitouloulou", "Maman Pitchou Alvero", "Papa Sam Alvero", "Sam jr. Alvero", "Shayann Alvero", "Nolivia Bitsindou"],
  22: ["Laurie-Anne Ribeiro", "Arcange Ntokua", "Dias Ntokua", "Adrienne Mbangu", "Elina Joseph", "Valerie Joseph", "Daniel joseph", "Charlotte Secke", "Zachée Secke", "Mickaël Ribeiro"],
  23: ["Josly Nuamosi-Mbambu", "Mélina Kiangala", "Lizéa Mbila", "Jerode Muzezenu", "Henriette Muzezenu", "Tsippora Miakukila", "Khezia Miakukila", "Erwann Kadina", "Helda Makuntima", "Miguel Bemvindo"],
  24: ["Rosie Unzitisa", "Sebastien Unzitisa", "Lily Nuamosi", "José Nuamosi", "Josian Nuamosi", "Joan Nuamosi", "Rosette Bolamba", "Koffi Bolamba", "Sevrine Lotisi", "Isaac Lotisi"],
  25: ["Jerry Muzezenu", "Chantale Muzezenu", "Jerry Junior Muzezenu", "Maguy Mawete Makinu", "Alain Nsakala", "Anita Nsakala", "Mifi Mbiki", "Serge Mbiki", "Etienne Mawete Makinu", "Odette Muzezenu"],
  26: ["Wytney Da Veiga", "Mariame Doumbia", "Aissatou Doumbia", "Maeva Lorsold", "Dylan Lorsold", "Cédric Tyller BELINGA", "Dan Elenga", "Mika Fleurival", "Anne Fuema", "Jonathan Kumbi"],
  27: ["Karl Isolokele", "Jean-Clivens Le Caous", "Cedrik LeCaous", "Sami Simon", "Jovany Germain", "Momo Sidibe", "Naomi SHANGO", "Vanilla TJOM", "Alyson Choy", "Kai Choy"],
  28: ["Maguy Celestina Mundanda Nsita", "Paul Mundanda Nsita", "Renense Mundanda Nsita", "Tressy Mundanda Nsita", "Roger (Ami Eliano) Culumbu", "Artiste VIP Ango Stars", "Artiste Ango Stars", "Niveline Mbangu", "Nicole Mbangu", "Pauliana Mundanda Nsita"],
  29: ["Laura Humba", "Raphael Opetum Isei Ngalula", "Weplo Culumbu", "Sylvie Culumbu", "Nicole Tusevo", "Elvis Tusevo", "Safira Tusevo", "Dorcas Matembe", "Divine Simao", "Sergio Manuel"],
  30: ["Roger Landu", "Betty Jeanne Closse", "Lucien Closse", "Richard Landu", "Sem Landu", "Dorine Landu", "Lys Landu", "Rémy Landu", "Denise Landu", "Nadine Landu"],
  31: ["Nadine Kimbau", "Debest Pello", "Claudine Pello", "Eude Matondo", "Antoinette Kimbau", "Cady Belida", "Marleine Bansimba", "Laetitia Bongo", "Youyou Lembe Tchiteya", "Odette Manuel"],
  32: ["Guillaume Mayimakanda", "Maman Elima", "Yves ELIMA", "Charlene ELIMA", "Seba Domingos", "Lucie Nzuzi", "Keren Malungu", "Keziah Malungu", "Maman Domingos", "Clavert Domingos"],
  33: ["Esmeralda Vemba", "Plamedi Okito", "Darleine Okito", "Estelle Okito", "ANNE KAYLEE MAMBAKASA", "KHEIRA MAMBAKASA", "Domingas Ferreira", "Isabel Ferreira", "KENAYA MAMBAKASA", "Makaia Vemba Ferreira"],
  34: ["Jean-Claude Nsenda", "Noel Nsenda", "Moise Nsenda", "Aurelie Nsenda", "Augustin Nsenda", "Ruben Lopez", "Martinette Lopez", "Gladys Lopez", "Eden Lopez", "Veronique Nsenda"],
  35: ["Clement Luvuasi", "Maguy Luvuasi", "Kamal Bekka", "Kizomba Artist", "Denis Beijinho", "Samy Archange", "Dede DelaVille", "Marta Bekka", "Ines Bekka", "Geodray Luvuasi"],
  36: ["Joeliane Elmacin Lumbu", "Lumbu Mabanza Joël", "Herve Menga", "Luzolo Patrick Menga", "Francisco Matondo", "Huguette Matondo", "Tuzola SAVIERA", "Riffick Saviera", "Keith Saviera", "Mercia Saviera"],
  37: ["Bangaly Souare", "Yannick Abdoul Camara", "Tiphaine Abdoul Camara", "Thomas Wandubula", "Jean-Claude Onokoko", "Cécile Mbila", "Jean Mbila", "Denise Nkoussou", "David Cairaschi", "Fatou Diaby"],
  38: ["Sofiane Mabata", "Mernad Mabata", "Bana Menga", "Bana Menga", "Lambert Menga", "Jacquie Menga", "Jennifer Bembo", "Joël Bembo", "Diklavin Mabata", "Nadia Mabata"],
  39: ["Priscile Makuntima", "Barnabe Shungu", "Isidore Luyindula", "Glody Kambwa", "Lucien Shampe", "Léna Vinelle Nganga", "Jeanne Tona", "Helène Tona", null, "Ahicam Damuna"],
  40: ["Simao Guilherme", "Michelina Guilherme", "Gisele Bopima", "Michaud Mabata", "Merline Mabata", "Glavina Lukoki", "Daryl Lukoki", "Gladys Lukoki", "Dany Lukoki", "Raphael Da Silva"],
  41: ["Brady Landu", "Julia Moussaoui", "Greg Moussaoui", "Maeva Moussaoui", "Roger Makongo", "Axel Tacita", "Solena Marzollo", "Daeve Landu", "Dylan Landu", "Victoria Landu"],
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
