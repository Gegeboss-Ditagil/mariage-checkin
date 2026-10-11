import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  androidBrowserLabel,
  buildChromeIntentUrl,
  CHROME_PLAY_STORE_URL,
  detectInstallPlatform,
  isChromeInstallHandoff,
  stripInstallParam,
} from '../lib/installPlatform.ts';

// v1.81.0 — signalé par Gersom le 11/10/2026 : beaucoup d'utilisateurs Android
// voient « Google Play Protect — Appli non sécurisée bloquée — Cette
// application a été conçue pour une version plus ancienne d'Android » en
// installant « Check-in ». Cause : Samsung Internet (et d'autres navigateurs
// constructeurs) fabriquent eux-mêmes l'APK de la PWA avec une ancienne
// version cible ; Chrome passe par Google et n'est jamais bloqué. Ces tests
// verrouillent : détection fiable par user-agent réel, jamais de prompt natif
// hors Chrome, redirection vers Chrome correcte, manifest stable.

// User-agents réels (Android 14/15/16).
const UA = {
  chrome:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.81 Mobile Safari/537.36',
  chromePixel:
    'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  samsung:
    'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  xiaomi:
    'Mozilla/5.0 (Linux; U; Android 14; fr-fr; 23129RAA4G Build/UKQ1.230804.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 XiaoMi/MiuiBrowser/14.10.1-gn',
  huawei:
    'Mozilla/5.0 (Linux; Android 12; NOH-NX9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 HuaweiBrowser/14.0.5.302 Mobile Safari/537.36',
  firefox: 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
  opera:
    'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36 OPR/85.0.0.0',
  edge:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36 EdgA/129.0.0.0',
  webview:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.81 Mobile Safari/537.36',
  facebook:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.81 Mobile Safari/537.36 [FBAN/EMA;FBLC/fr_FR;FBAV/400.0.0.0;]',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1',
  desktop:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
};

test('Chrome Android est reconnu comme android-chrome (prompt natif autorisé)', () => {
  assert.equal(detectInstallPlatform(UA.chrome), 'android-chrome');
  assert.equal(detectInstallPlatform(UA.chromePixel), 'android-chrome');
});

test('Samsung Internet (cause du blocage Play Protect) est android-other malgré « Chrome/ » dans son user-agent', () => {
  assert.equal(detectInstallPlatform(UA.samsung), 'android-other');
  assert.equal(androidBrowserLabel(UA.samsung), 'Samsung Internet');
});

test('les autres navigateurs Android basés sur Chromium sont android-other', () => {
  for (const key of ['xiaomi', 'huawei', 'opera', 'edge'] as const) {
    assert.equal(detectInstallPlatform(UA[key]), 'android-other', key);
  }
});

test('Firefox Android est android-other', () => {
  assert.equal(detectInstallPlatform(UA.firefox), 'android-other');
});

test('un lien ouvert dans WhatsApp/Facebook (WebView) est android-other : une WebView ne peut pas installer', () => {
  assert.equal(detectInstallPlatform(UA.webview), 'android-other');
  assert.equal(detectInstallPlatform(UA.facebook), 'android-other');
  assert.match(androidBrowserLabel(UA.facebook), /intégré/);
});

test('iOS et ordinateur ne changent pas de comportement', () => {
  assert.equal(detectInstallPlatform(UA.iphone), 'ios');
  assert.equal(detectInstallPlatform(UA.iphoneChrome), 'ios');
  assert.equal(detectInstallPlatform(UA.desktop), 'other');
  assert.equal(detectInstallPlatform(''), 'other');
  assert.equal(detectInstallPlatform(undefined), 'other');
});

test('le lien « Ouvrir dans Chrome » vise Chrome, garde https, la même page, et ajoute ?install=chrome', () => {
  const intent = buildChromeIntentUrl('https://mariage-checkin.vercel.app/login?next=%2Fscan');
  assert.ok(intent.startsWith('intent://mariage-checkin.vercel.app/login?'), intent);
  assert.match(intent, /next=%2Fscan/);
  assert.match(intent, /install=chrome/);
  assert.match(intent, /#Intent;scheme=https;package=com\.android\.chrome;/);
  assert.ok(intent.endsWith(';end'));
  // Sans Chrome installé : la fiche Play Store de Chrome, jamais une page vide.
  assert.ok(intent.includes(`S.browser_fallback_url=${encodeURIComponent(CHROME_PLAY_STORE_URL)}`));
});

test('le lien ne duplique pas ?install=chrome si déjà présent', () => {
  const intent = buildChromeIntentUrl('https://mariage-checkin.vercel.app/login?install=chrome');
  assert.equal(intent.match(/install=chrome/g)?.length, 1);
});

test('arrivée dans Chrome : ?install=chrome est détecté puis retiré de l\'URL', () => {
  assert.equal(isChromeInstallHandoff('?install=chrome'), true);
  assert.equal(isChromeInstallHandoff('?next=%2Fscan&install=chrome'), true);
  assert.equal(isChromeInstallHandoff('?install=autre'), false);
  assert.equal(isChromeInstallHandoff(''), false);
  assert.equal(stripInstallParam('https://x.app/login?next=%2Fscan&install=chrome'), '/login?next=%2Fscan');
  assert.equal(stripInstallParam('https://x.app/login?install=chrome'), '/login');
});

const buttonSource = readFileSync(new URL('../components/InstallAppButton.tsx', import.meta.url), 'utf8');

test('InstallAppButton ne déclenche jamais le prompt natif hors Chrome sur Android', () => {
  assert.match(buttonSource, /const mustUseChrome = platform === 'android-other'/);
  assert.match(buttonSource, /if \(!mustUseChrome && \(await runNativePrompt\(\)\)\) return;/);
});

test('InstallAppButton propose « Ouvrir dans Chrome » via buildChromeIntentUrl et explique le message Play Protect', () => {
  assert.match(buttonSource, /buildChromeIntentUrl\(window\.location\.href\)/);
  assert.match(buttonSource, /Ouvrir dans Chrome/);
  assert.match(buttonSource, /Appli non sécurisée bloquée/);
  assert.match(buttonSource, /Installer via Chrome/);
});

test('manifest : identité stable (id) et scope racine, pour que Chrome garde la même app installée', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.id, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some((i: any) => i.sizes === '512x512' && i.purpose === 'maskable'));
});
