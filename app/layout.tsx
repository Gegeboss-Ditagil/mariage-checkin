import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { OnlineIndicator } from '@/components/OnlineIndicator';

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
  themeColor: '#1a2942',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <ServiceWorkerRegister />
        <OnlineIndicator />
        <div className="mx-auto min-h-dvh max-w-md safe-top safe-bottom">{children}</div>
      </body>
    </html>
  );
}
