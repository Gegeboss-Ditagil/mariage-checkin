import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';

export default function Home() {
  const user = getSessionUser();

  if (!user) redirect('/login');
  if (user.role === 'placeur') redirect('/placement');
  redirect('/scan');
}
