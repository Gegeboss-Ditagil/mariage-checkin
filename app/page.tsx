import { getSessionUser } from '@/lib/session';
import { SplashScreen } from '@/components/SplashScreen';
import { landingPathForRole } from '@/lib/permissions';

export default function Home() {
  const user = getSessionUser();

  let next = '/login';
  if (user) {
    next = landingPathForRole(user.role);
  }

  return <SplashScreen next={next} />;
}
