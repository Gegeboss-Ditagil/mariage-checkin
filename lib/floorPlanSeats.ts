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
export const TABLE_SEAT_NAMES: Record<number, (string | null)[]> = {
  1: ["Herve Menga", "Jean-Ciben Ca ous", null, "Hadelin Yezi", "Domingas Ferreira", null, "Deborah Yezi", "Lys Landu", "David-Junior Lukau", "Eutyche Lukau"],
  2: ["Erika Dos Goncalves", "Isabel Vemba", "Mona Vemba", "Deusdedit Dos Goncalves", "Joel Dos Goncalves", "Luis Dos", "Gaby Dos", null, null, null],
  3: ["Neves Kilo-Nzuzi", "Leverry Kirzi", "Jonas Mpindi", "Henry Kiadi Ndiongo", "Sumali Ndiongo", "Diton Kiala Diamena", "Oredezo Blancky", "Costa Mvovi", "Invité n.n. (338)", "Edo Tukwa"],
  4: ["Micheta Teksanda", "Henri O. Momba", "Henricia O. Momba", "Thierry M. Mavinga", "Dorothée D. Nsingani", "Stacky M. Mavinga", "Kelcy M. Mavinga", "Jessy B. M. Mavinga", "Taylor M. Mavinga", "Fixon Zola"],
  5: ["Maria Miputuilu", "Graça Inacio", "André Neves", "Chantal Neves", "Papa David Lukau", "Maman J. Lukau", "Edouard K. Mbuta", "femme e.k. mbuta", "Elisa Jean", "Alfred Jean"],
  6: ["Nsimba Mambakasa", "Helder Vemba", "Kupesa Lando Ferreira", "Eugenia S. Chipala", "Mbulu Esamba", "Tchecka Mbulu", "Papy Mamona", "Adriano Vemba", "Mervelle Makaya", "Pajos Mpapa"],
  7: ["Filho 1 Culumbu", "Epoux Tia Sonia", "Sarah Tahan", "Seda Tahan", "Tia Sonia Culumbu", "Femme Culumbu", "Filho 4 Culumbu", "Tio Gille Culumbu", "Filho 3 Culumbu", "Filho 5 Culumbu"],
  8: ["Lale Culumbu", "Celestina Yezi", "Mahjo Yezi", "Odette Culumbu", "Waku Menga", "Julie Indanda", "Simao Guilherme", "Michelina Guilherme", "Luzolo P. Menga", "Tia Nzuzi Culumbu"],
  9: ["Mamita Ndani", "Erik Lema", "Lotine André", "André Nsiangangu", "Femme Nsiangangu", "Enfant Nsiangangu", "Maurice N. Ndoba", "Keyris Ndani", "Gresse J. Nzengo", "Grace Tshisungu"],
  10: ["Stephanie B. Mituele", "Rose-marie Kumba", "Qeren Moba-Mbemba", "Naomie Ghansi", "Kevin GHANSI", "Josué Ghansi", "Fyra Biyoud", "Chindege Moba-Mbemba", "Ruth Mwimba", "Ted Mwimba"],
  11: ["Teresa Ndani", "Loïc Neves", "Gloire André", "Gabriel S. Sanda", "Andrea Neves", "Ketsia Neves", "Jonathan Ndani", "Bontse T. Ndani", null, null],
  12: ["Sylvie Bulisi", "Louise N. Nsenga", "Nana Mabumba", "Felix Luboya", "Tatiana Bitumazala", "Yvan Bitumazala", "Diane Eberhorn", "Rose Bulisi", "Joana Lusuena", "Fifi Lusuena"],
  13: ["Simon Mbidi", "Mona Guyguy Vemba", "Suzie Vemba", "Abeti Okito", "Johny Okito", "Bijou Mambakasa", "Gisèle Mambakasa", "Roily Makaya Mvemba", "Johny Kiala", "Danyl Mbidi"],
  14: ["Jordy Ungeli", "Dorcas Massamba", "Hugo Massamba", "Imeon Massamba", "Ludovic Eckombard", "Sita Muzemba", "Stephenson Bulaki", "Garile Bulaki", "Carl Aye", "Enricka Aye"],
  15: ["Tuzola Saviera", "Keith Saviera", "Riffick Saviera", "Mercia Saviera", "Sister 2 Malungu", "Ruben K. Malungu", "Maguy Malungu", "Sister 1 Malungu", "Keziah Malungu", null],
  16: ["Djessus S. Tulomba", "Yeze Zinga", "Sephora Tulomba", "Jessica Tulomba", "Silva Mvuemba", "Melissa Mvuemba", "Yorma Formosa", "Nzuzi Laisana", "Olivier Benga", null],
  17: ["Jessica Jean", "Joelis Jean", "Jeremie Luyindula", "Lynda Luyindula", "Gloria Luyindula", "Manuela Zerrougui", "Raffik Zerrougui", "Aimé Luyindula", "Prémices Jean", "Deborah Brigitte"],
  18: ["Furty Matuba", "Melanie Matuba", "Bernard Kadina", "Sylvie Kadina", "Regine Nkoyi", "Victor Nkoyi", "Marie-Chantal Kiangala", "Graça Lorena Gomes", "Zola Martine Gomes", "Maria Irene Gomes"],
  19: ["Vicky Nsumbu Mvuza", "Ben Messan", "Anais Messan", "Benson Messan", "Adeline Makopa", "Kemal Makiese", "Michele Isolonge", "Christine Kaseka", "Bionic Kileki", "Tryphène Kileki"],
  20: ["Carine Sagbo", "Dany Dasilva", "Felicia Ndedi", "Prosper Chi Nche", "Sylviane Jeanne", "Ghislain Mayemba", "Charlene Coulibaly", "Souleyman Gassama", "Divine Masiala", "Awa Kamate"],
  21: ["Nolivia Bitsindou", "Line Kwatchou", "Additional G. 1", "Sidney Momoh", "Onehi Momoh", "Silvann Bitoulaou", "Mamàn P. Alvero", "Papa Sam Alvero", "Sam jr. Alvero", "Shayann Alvero"],
  22: ["Mickaël Ribeiro", "Laurie-Anne Ribeiro", "Arcange Ntokua", "Dias Ntokua", "Adrienne Mbuangu", "Ella Joseph", "Valerie Joseph", "Daniel Joseph", "David Cairaschi", "Grâce Ndonga"],
  23: ["Miguel Bemvindo", "Josly Nuamosi-Mbambu", "Melina Kiangala", "Lizéa Mbila", "Jerode Muzezenu", "Henriette Muzezenu", "Tsippora Miakukila", "Khezia Miakukila", "Erwann Kadina", "Elda Makurima"],
  24: ["Isaac Lotisi", "Rosie Unzitisa", "Sebastien Unzitisa", "Lily Nuamosi", "José Nuamosi", "Josian Nuamosi", "Joan Nuamosi", "Rosette Bolamba", "Koffi Bolamba", "Sévrine Lotisi"],
  25: ["Odette Muzezenu", "Jerry Muzezenu", "Chantale Muzezenu", "Jerry Junior Muzezenu", "Maguy Ma. Makinu", "Alain Nsakala", "Aríta Nsakala", "Mifi Mbiki", "Serge Mbiki", "Etienne M. Makinu"],
  26: ["Ashnee Barclay", "Cedric LeCaous", "Maman S. Jean-Baptiste", "Dylan Lorsold", "Maeva Lorsold", "Jonathan Kumbi", "Anne Fuema", "Mika Fleurival", "Dan Elenga", "Cedric T. BELINGA"],
  27: ["Jamie de Naomi", "Karl Isolokele", "Mademoiselle Isolokele", "Frank Mbonda", "Sami Simon", "Jovany Germain", "Henry Karl Jeanine", "Momo Sdibe", "Naomi SHANGO", "Vanilla TIOM"],
  28: ["Celestina M. Nsita", "Amy Elono", "Paul M. Nsita", "Renense M. Nsita", "Tressy M. Nsita", "Pauliana M. Nsita", "Niveline Mbangu", "Nicole Mbangu", "Accompagnant non-nommé", "Accompagnant non-nommé"],
  29: ["Rafael O. Isei", "Prince Nzasi", "Babel Nzasi", "Sergio Manuel", "Rene Herrera", "Ya Dany Culumbu", "Wegio Culumbu", "Accompagnant non-nommé", "Laura Humba", "Enfant Nzasi"],
  30: ["Sem Landu", "Dorine Landu", "Roger Landu", "Nadine Landu", "Richard Landu", "Denise Landu", "Rémy Landu", "Betty Jeanne Closse", "Lucien Closse", "Daeve Landu"],
  31: ["Debest Pellio", "Claudine Pello", "Odette Manuel", "Nadine Kimbau", "Steven Kimbau", "Antoinette Kimbau", "Cady Belida", "Marleine Bansimba", "Laetitia Bongo", "Youyou Le Tchreya"],
  32: ["Accompagnant non-nommé", "Lucie Nzuzi", "Seba Domingos", "Lina Kumpesa", "Guillaume Mayimaka", null, "Yves Elima", "Chariene Elima", "Maman Elima", "Clavert Domingos"],
  33: ["Emilia Mbidi", "Esmeralda Vemba", "Piamedi Okito", "Darlaine Okito", "Estelle Okito", "Anne Kayl Mambakasa", "Kheira Mambakasa", "Kenaya Mambakasa", "Makaia Vemba Ferreira", "Isabel Ferreira"],
  34: ["Veronique Nsenda", "Jean-Claude Nsenda", "Noel Nsenda", "Moïse Nsenda", "Aurelie Nsenda", "Augustin Nsenda", "Ruben Lopez", "Martinette Lopez", "Gladys Lopez", "Eden Lopez"],
  35: ["Maguy Luvuasi", "Geodray Luvuasi", "Kamai Bekka", "Marta Bekka", "Ines Bekka", "Clement Luvuasi", "Brady Landu", "Victoria Landu", "Allegria Mpilingi", "Dylan Landu"],
  36: ["Femme Michaud", "Sylvia Mpiassa", "Joao Mpiassa", "Darliane Mpiassa", "Jeansianne Mpiassa", "Lumbu M. Joel", "Joeliane Elmacin", "Helga Lumbu", "Lina Lumbu", "Michaud Cujumbu"],
  37: ["Fatou Diaby", "Bangaly Souaré", "Yannick A. Camara", "Tiphaine A. Camara", "Thomas Wandubula", "Jean-Claude Onokoko", "Cécile Mbila", "Jean Mbila", "Denise Nkoussou", null],
  38: ["Accompagnant non-nommé", "Nicole Tusevo", "Elvis Tusevo", "Accompagnant non-nommé", "Accompagnant non-nommé", "Divine Simao", "Dorcas Materbie", "Nadia Mabata", "Accompagnant non-nommé", null],
  39: ["Ahicam Damuna", null, "Priscile Makuntima", "Lucien Shampe", "Isidore Luyindula", "Glody Kambwa", "Léna Vinelle Ngenge", "Jeanne Tona", "Hélène Tona", "Barnabe Shungu"],
  40: ["Julianna Matondo", "Jennifer Bembo", "Joël Bembo", "Jessiline Mateus", "Bob Culumbu", "Dislon Lumbu", "Maracho Lumbu", "Eude Matondo", "Francisco Matondo", "Huguette Matondo"],
  41: ["Jackie Menga", "Lambert Menga", "Bana Menga", "Bana Menga", null, null, null, null, "Diego Ramos", "Jade Magnus"],
  42: [null, null, null, null, null, null, null, null, null, null],
};
