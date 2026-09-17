import type { Metadata, Viewport } from 'next';
import { Playfair_Display, Inter } from 'next/font/google';
import { ViewTransitions } from 'next-view-transitions';
import './globals.css';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { OnlineIndicator } from '@/components/OnlineIndicator';
import { InstallAppButton } from '@/components/InstallAppButton';
import { GlobalErrorLogger } from '@/components/GlobalErrorLogger';

const displayFont = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const sansFont = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_EVENT_NAME || 'Check-in Mariage',
  description: "Application de check-in pour l'entree des invites",
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: process.env.NEXT_PUBLIC_EVENT_NAME || 'Check-in',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // 'resizes-content' (retour de Gersom le 17/09/2026, capture d'ecran
  // /agenda : "j'appuie sur les cartes, ca me sort le clavier... mais ca
  // bug apres") : sans lui, Safari/WKWebView ne retaille QUE le viewport
  // visuel quand le clavier apparait -- les unites `dvh` utilisees par tous
  // les panneaux modaux (`fixed inset-0`, `max-h-[88dvh]`) restent figees a
  // la hauteur PLEINE, et le navigateur tente alors de faire defiler toute
  // la mise en page fixe pour amener le champ actif au-dessus du clavier --
  // bug WebKit tres documente ("fixed position + focused input + clavier")
  // qui fait sauter/decaler brutalement le panneau. `resizes-content` fait
  // au contraire retailer le viewport de MISE EN PAGE lui-meme a l'ouverture
  // du clavier : les `dvh` se remettent a jour normalement, le panneau
  // (deja `overflow-y-auto`) se retasse proprement dans l'espace visible
  // restant, sans saut. Diagnostic par lecture du code/de la specification
  // (aucun appareil iOS reel disponible dans cet environnement) -- a
  // reconfirmer par Gersom.
  interactiveWidget: 'resizes-content',
  themeColor: '#f4f4f7',
};

// v1.53.16, retour de Gersom : "beaucoup de flash... base-toi sur le style
// iOS natif... la navigation, comment est-ce que les éléments se déplacent".
// View Transitions API (via next-view-transitions, meme approche que
// recommandee par l'equipe Next.js avant son support natif dans le
// framework) : capture un instantane de l'ancienne page et fond
// doucement vers la nouvelle au lieu d'un remplacement brut du DOM -- masque
// tout residu de flash de peinture entre deux onglets, et se rapproche du
// fondu instantane d'un UITabBarController natif. Sans effet (retombe sur
// une navigation normale, sans erreur) sur les navigateurs sans support de
// document.startViewTransition -- degrade proprement, jamais bloquant.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransitions>
    <html lang="fr" className={displayFont.variable + ' ' + sansFont.variable}>
      <head>
        {/*
          Pose data-theme avant le premier rendu pour eviter un flash entre
          les deux modes (le choix vit en localStorage, voir hooks/useTheme.ts
          -- meme cle et memes valeurs a garder en phase, y compris 'system'
          qui suit prefers-color-scheme). Script minimal et synchrone : pas de
          dependance, pas de hook ici.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('checkin-theme');var d=t==='dark'||(t==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.dataset.theme='dark';var m=document.querySelector('meta[name=\"theme-color\"]');if(m)m.setAttribute('content','#14141a');}}catch(e){}",
          }}
        />
      </head>
      <body>
        <ServiceWorkerRegister />
        <OnlineIndicator />
        <GlobalErrorLogger />
        {/*
          Monte au niveau racine (et non sur une seule page) pour que
          l'ecouteur "beforeinstallprompt" soit attache des le tout premier
          affichage, quelle que soit la page d'entree (ex: un agent deja
          connecte qui arrive directement sur /scan sans repasser par
          /login). Sans ca, l'evenement peut se declencher avant que le
          composant n'existe et etre perdu definitivement pour cette visite.
        */}
        <InstallAppButton />
        {/*
          Portrait : conserve la colonne mobile centree historique.
          Paysage (iPhone tourne/iPad) : retire max-w-md pour que l'ecran
          applicatif occupe toute la largeur disponible. Sans cette bascule,
          BottomNav devenait bien vertical a droite... mais au bord d'une
          colonne de 448 px, laissant deux grandes bandes laterales sur iPad.
        */}
        <div className="mx-auto min-h-dvh w-full max-w-md safe-top safe-bottom landscape:max-w-none">{children}</div>
      </body>
    </html>
    </ViewTransitions>
  );
}
