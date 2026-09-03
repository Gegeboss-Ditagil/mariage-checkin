import { getSessionUser } from '@/lib/session';
import { SplashScreen } from '@/components/SplashScreen';
import { hasCapability, landingPathForRole } from '@/lib/permissions';
// Version affichee en filigrane sur le splash avant connexion -- demande de
// Gersom le 03/09/2026 : "chaque fois que j'ouvre, je peux savoir si je suis
// en train de voir la dernière version". Importee directement depuis
// package.json (source de verite unique, voir docs/VERSIONING.md) plutot
// qu'une variable d'environnement dupliquee : elle ne peut donc jamais
// dériver du numero reellement deploye, quel que soit l'agent qui modifie
// le code.
import { version } from '@/package.json';

export default function Home() {
  const user = getSessionUser();

  let next = '/login';
  if (user) {
    next = landingPathForRole(user.role);
  }

  return (
    <SplashScreen
      next={next}
      warmApprovals={!!user && hasCapability(user.role, 'viewGuestApprovals')}
      version={version}
    />
  );
}
