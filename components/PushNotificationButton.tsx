'use client';

import { useState } from 'react';

function toUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

export function PushNotificationButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'enabled' | 'unsupported' | 'denied' | 'unavailable'>('idle');

  async function enable() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setStatus('unsupported');
      return;
    }
    setStatus('loading');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') { setStatus('denied'); return; }
    const keyResponse = await fetch('/api/push/vapid-public-key');
    if (!keyResponse.ok) { setStatus('unavailable'); return; }
    const { public_key: publicKey } = await keyResponse.json();
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8Array(publicKey).buffer as ArrayBuffer });
    const response = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription.toJSON()) });
    setStatus(response.ok ? 'enabled' : 'unavailable');
  }

  const label = status === 'enabled' ? 'Notifications activées' : status === 'loading' ? 'Activation…' : status === 'denied' ? 'Notifications refusées' : status === 'unsupported' ? 'Notifications non prises en charge' : status === 'unavailable' ? 'Push non configuré — les demandes restent visibles ici' : 'Activer les notifications';
  return <button type="button" onClick={enable} disabled={status === 'loading' || status === 'enabled'} className="action-row mb-3 text-sm disabled:opacity-60">🔔 {label}</button>;
}
