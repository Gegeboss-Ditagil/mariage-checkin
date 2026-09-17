// Version du FORMAT du jeton de session (le contenu du payload signe -- voir
// SessionUser dans lib/types.ts), jamais liee au deploiement Vercel courant.
//
// Avant le 17/09/2026, `ver` valait `VERCEL_DEPLOYMENT_ID` (ou son fallback
// git sha) : CHAQUE deploiement -- y compris un correctif sans aucun rapport
// avec les sessions -- invalidait instantanement toutes les sessions actives
// et deconnectait tout le monde a la prochaine requete protegee. Sur ce
// projet, qui deploie tres frequemment (plusieurs fois par jour en
// developpement actif), c'etait la cause principale du signalement de
// Gersom le 17/09/2026 : "j'ai un probleme de deconnexion enorme... surtout
// quand on navigue de page rapidement, apres 5-6 pages, ca se deconnecte
// souvent" -- chaque nouveau lien BottomNav visible a l'ecran declenche un
// prefetch Next.js (donc une verification de session en arriere-plan), et
// chaque deploiement pendant une session active la faisait echouer.
//
// Le jour du mariage, ce mecanisme aurait aussi pu deconnecter tout le
// personnel d'un coup si un correctif d'urgence etait deploye pendant
// l'evenement -- exactement le scenario a eviter ("objectif zero bug de
// navigation le jour J").
//
// Desormais une simple constante, incrementee A LA MAIN uniquement quand le
// FORMAT du payload change reellement (ex: un champ SessionUser ajoute/
// retire/renomme) -- jamais a chaque deploiement. Un deploiement de code
// n'invalide plus aucune session ; seule l'expiration naturelle (12h,
// SESSION_MAX_AGE_SECONDS) ou un changement de SESSION_SECRET la termine.
export const SESSION_SCHEMA_VERSION = '2';
