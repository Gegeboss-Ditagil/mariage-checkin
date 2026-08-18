import { getSessionUser } from '@/lib/session';
import { SplashScreen } from '@/components/SplashScreen';

export default function Home() {
  const user = getSessionUser();

  let next = '/login';
  if (user) {
    next = user.role === 'placeur' ? '/placement' : '/scan';
  }

  return <SplashScreen next={next} />;
}
