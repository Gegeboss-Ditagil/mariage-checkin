import type { Metadata, Viewport } from 'next';
import { Playfair_Display, Inter } from 'next/font/google';
import './globals.css';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { OnlineIndicator } from '@/components/OnlineIndicator';
import { InstallAppButton } from '@/components/InstallAppButton';

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
  // Valeur par defaut (Atrium clair) ; le script anti-flash ci-dessous et
  // hooks/useTheme.ts la mettent a jour cote client des que le theme effectif
  // (Maison sombre, ou 'Automatique' resolu via prefers-color-scheme) est
  // connu -- Next ne permet pas de valeur conditionnelle ici cote serveur.
  themeColor: '#f4f4f7',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
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
  );
}
