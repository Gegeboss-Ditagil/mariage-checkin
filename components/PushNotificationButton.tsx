'use client';

import { useEffect, useState } from 'react';

function toUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

// Aucune API web (iOS ou Android) ne permet d'ouvrir directement le reglage
// systeme des notifications d'une PWA -- contrairement a getUserMedia
// (camera), qui affiche sa propre invite native depuis la page elle-meme,
// quelle que soit la plateforme. Demande de Gersom le 13/09/2026 : "quand
// j'appuie... j'aimerais que ça m'amène directement dans les settings...
// un peu comme quand tu me fais le prompt caméra" -- ce comportement n'est
// simplement pas exposable au web (ni deep-link vers Reglages, ni
// re-declenchement du prompt apres un refus explicite, sur aucune des deux
// plateformes : restriction navigateur/OS, pas un choix de ce code). Le
// mieux qu'on puisse faire : detecter precisement l'etat et donner le
// chemin exact a suivre dans les reglages du telephone.
function detectPlatform(): 'ios' | 'android' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return 'ios';
  if (/android/i.test(navigator.userAgent)) return 'android';
  return 'other';
}

const DENIED_INSTRUCTIONS: Record<ReturnType<typeof detectPlatform>, string> = {
  ios: "Réglages de l'iPhone → faites défiler jusqu'à cette application → Notifications → activez « Autoriser les notifications ». Revenez ensuite ici et relancez l'app.",
  android: "Appui long sur l'icône de l'application → Infos sur l'appli → Notifications → activez-les. (Ou : Réglages du téléphone → Applications → cette application → Notifications.)",
  other: 'Autorisez les notifications pour ce site dans les réglages de votre navigateur (icône cadenas à côté de l’adresse), puis rechargez la page.',
};

export function PushNotificationButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'enabled' | 'unsupported' | 'denied' | 'in_app'>('idle');

  // v1.53.4, retour de Gersom : après avoir réellement autorisé les
  // notifications (et reçu une vraie alerte push sur son iPhone), le bouton
  // restait bloqué sur « notifications à configurer » -- le state démarrait
  // toujours à 'idle' et ne se mettait à jour qu'en réaction à un clic dans
  // la session en cours, jamais en vérifiant l'état réel du navigateur/OS au
  // chargement. Ce useEffect réconcilie le statut affiché avec la permission
  // et l'abonnement réels dès le montage, pour que le message ne mente
  // jamais une fois l'activation véritablement effective.
  useEffect(() => {
    let cancelled = false;
    async function reconcile() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        if (!cancelled) setStatus('unsupported');
        return;
      }
      if (Notification.permission === 'denied') {
        if (!cancelled) setStatus('denied');
        return;
      }
      if (Notification.permission === 'granted') {
        try {
          const registration = await navigator.serviceWorker.ready;
          const existing = await registration.pushManager.getSubscription();
          if (!cancelled) setStatus(existing ? 'enabled' : 'idle');
        } catch (error) {
          console.error('Echec verification abonnement notifications push', error);
        }
        return;
      }
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
      if (isIos && !isStandalone && !cancelled) {
        setStatus('in_app');
      }
    }
    void reconcile();
    return function cleanupReconcile() {
      cancelled = true;
    };
  }, []);

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

  // Instructions pas-a-pas -- seul recours possible cote web (voir la note
  // en tete de fichier), affichees uniquement quand une action manuelle est
  // vraiment necessaire (refus explicite, ou iOS pas encore installe).
  const helpText =
    status === 'denied'
      ? DENIED_INSTRUCTIONS[detectPlatform()]
      : status === 'in_app'
        ? "Ajoutez d'abord cette page à l'écran d'accueil : bouton Partager (□↑) dans Safari → « Sur l'écran d'accueil ». Relancez ensuite l'app depuis cette icône et appuyez de nouveau ici pour activer les notifications."
        : null;

  return (
    <div className="mb-3">
      <button type="button" onClick={enable} disabled={status === 'loading' || status === 'enabled'} className="action-row text-sm disabled:opacity-60">🔔 {label}</button>
      {helpText && <p className="mt-1.5 px-1 text-xs text-text-faint">{helpText}</p>}
    </div>
  );
}
