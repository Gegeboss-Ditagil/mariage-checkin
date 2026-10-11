/**
 * v1.81.0 — Installation Android sans blocage Google Play Protect.
 *
 * Contexte (signalé par Gersom le 11/10/2026, capture « Appli non sécurisée
 * bloquée — Cette application a été conçue pour une version plus ancienne
 * d'Android ») : sur Android, « installer » la PWA fait fabriquer par le
 * NAVIGATEUR un vrai APK (WebAPK). Chrome passe par le service de Google,
 * qui produit un APK à jour. Samsung Internet (et d'autres navigateurs
 * constructeurs) utilisent leur propre service, qui produit un APK visant
 * une ancienne version d'Android : Android 14+ / Play Protect le bloquent.
 * Aucun réglage du manifest ne change la cible de cet APK : la seule
 * correction côté app est de faire installer via Chrome.
 *
 * Ce module est pur (aucun accès à window) pour être testé sous node --test.
 */

export type InstallPlatform =
  /** iPhone / iPad : installation manuelle via Partager → Sur l'écran d'accueil. */
  | 'ios'
  /** Chrome Android : prompt natif, APK fabriqué par Google, jamais bloqué. */
  | 'android-chrome'
  /** Autre navigateur Android (Samsung Internet, Xiaomi, WebView WhatsApp…) : passer par Chrome. */
  | 'android-other'
  /** Ordinateur ou plateforme non reconnue : comportement inchangé. */
  | 'other';

export const CHROME_PACKAGE = 'com.android.chrome';
export const CHROME_PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${CHROME_PACKAGE}`;
/** Paramètre ajouté à l'URL ouverte dans Chrome pour y afficher directement l'aide d'installation. */
export const INSTALL_QUERY_PARAM = 'install';
export const INSTALL_QUERY_VALUE = 'chrome';

// Jetons de user-agent des navigateurs Android qui contiennent aussi
// « Chrome/ » (ils sont basés sur Chromium) mais ne sont PAS Chrome, et dont
// l'installation ne passe donc pas par le service WebAPK de Google.
const ANDROID_NON_CHROME_TOKENS: RegExp[] = [
  /SamsungBrowser\//i,
  /MiuiBrowser\//i,
  /XiaoMi\//i,
  /HuaweiBrowser\//i,
  /HeyTapBrowser\//i,
  /VivoBrowser\//i,
  /OppoBrowser\//i,
  /UCBrowser\//i,
  /\bOPR\//i,
  /OPT\//i,
  /EdgA\//i,
  /YaBrowser\//i,
  /DuckDuckGo\//i,
  /Firefox\//i,
  // Navigateurs intégrés (lien ouvert depuis WhatsApp, Facebook, Instagram…) :
  // une WebView ne peut pas installer d'app du tout.
  /;\s*wv\)/i,
  /FBAN|FBAV|Instagram|Line\//i,
];

export function detectInstallPlatform(userAgent: string | null | undefined): InstallPlatform {
  const ua = userAgent || '';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (!/android/i.test(ua)) return 'other';
  if (ANDROID_NON_CHROME_TOKENS.some((re) => re.test(ua))) return 'android-other';
  if (/Chrome\/\d+/i.test(ua)) return 'android-chrome';
  return 'android-other';
}

/** Nom lisible du navigateur détecté, pour le message affiché à l'invité/staff. */
export function androidBrowserLabel(userAgent: string | null | undefined): string {
  const ua = userAgent || '';
  if (/SamsungBrowser\//i.test(ua)) return 'Samsung Internet';
  if (/MiuiBrowser\/|XiaoMi\//i.test(ua)) return 'le navigateur Xiaomi';
  if (/HuaweiBrowser\//i.test(ua)) return 'le navigateur Huawei';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/\bOPR\/|OPT\//i.test(ua)) return 'Opera';
  if (/EdgA\//i.test(ua)) return 'Edge';
  if (/;\s*wv\)|FBAN|FBAV|Instagram|Line\//i.test(ua)) return 'le navigateur intégré à l’application';
  return 'ce navigateur';
}

/**
 * Construit un lien intent:// qui rouvre la page courante dans Chrome
 * (même URL, même origine HTTPS), avec ?install=chrome pour y afficher
 * l'aide d'installation. Si Chrome n'est pas installé, Android ouvre la
 * fiche Play Store de Chrome à la place.
 */
export function buildChromeIntentUrl(pageUrl: string): string {
  const url = new URL(pageUrl);
  url.searchParams.set(INSTALL_QUERY_PARAM, INSTALL_QUERY_VALUE);
  const scheme = url.protocol.replace(':', '');
  const withoutScheme = `${url.host}${url.pathname}${url.search}`;
  return (
    `intent://${withoutScheme}#Intent;scheme=${scheme};package=${CHROME_PACKAGE};` +
    `S.browser_fallback_url=${encodeURIComponent(CHROME_PLAY_STORE_URL)};end`
  );
}

/** Vrai si la page a été ouverte par buildChromeIntentUrl (arrivée dans Chrome pour installer). */
export function isChromeInstallHandoff(search: string | null | undefined): boolean {
  if (!search) return false;
  return new URLSearchParams(search).get(INSTALL_QUERY_PARAM) === INSTALL_QUERY_VALUE;
}

/** Retire ?install=chrome de l'URL (pour qu'un rechargement ne rouvre pas l'aide). */
export function stripInstallParam(pageUrl: string): string {
  const url = new URL(pageUrl);
  url.searchParams.delete(INSTALL_QUERY_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}
