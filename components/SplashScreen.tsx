'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const SPLASH_DURATION_MS = 3000;

export function SplashScreen({ next }: { next: string }) {
  const router = useRouter();
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), SPLASH_DURATION_MS);
    const navTimer = setTimeout(() => router.replace(next), SPLASH_DURATION_MS + 350);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(navTimer);
    };
  }, [next, router]);

  return (
    <div
      onClick={() => router.replace(next)}
      className={
        'fixed inset-0 z-50 flex items-center justify-center bg-[#1a2942] bg-cover bg-center bg-no-repeat transition-opacity duration-300 ' +
        (fading ? 'opacity-0' : 'opacity-100')
      }
      style={{ backgroundImage: "url('/images/splash-bg.jpg')" }}
    />
  );
}
