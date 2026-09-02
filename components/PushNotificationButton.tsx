'use client';

import { useState } from 'react';

function toUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

export function PushNotificationButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'enabled' | 'unsupported' | 'denied' | 'in_app'>('idle');

  async function enable() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setStatus('unsupported');
      return;
    }
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos && !isStandalone) {
      setStatus('in_app');
      return;
    }
    setStatus('loading');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setStatus('denied'); return; }
      const keyResponse = await fetch('/api/push/vapid-public-key', { cache: 'no-store' });
      if (!keyResponse.ok) { setStatus('in_app'); return; }
      const { public_key: publicKey } = await keyResponse.json();
      if (typeof publicKey !== 'string' || !publicKey) { setStatus('in_app'); return; }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toUint8Array(publicKey).buffer as ArrayBuffer,
      });
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
      setStatus(response.ok ? 'enabled' : 'in_app');
    } catch (error) {
      console.error('Echec activation notifications push', error);
      setStatus('in_app');
    }
  }

  const label = status === 'enabled'
    ? 'Notifications activées'
    : status === 'loading'
      ? 'Activation…'
      : status === 'denied'
        ? 'Notifications refusées dans les réglages'
        : status === 'unsupported'
          ? 'Alertes dans l’application actives'
          : status === 'in_app'
            ? 'Alertes dans l’application actives · notifications à configurer'
            : 'Activer les notifications';
  return <button type="button" onClick={enable} disabled={status === 'loading' || status === 'enabled'} className="action-row mb-3 text-sm disabled:opacity-60">🔔 {label}</button>;
}
