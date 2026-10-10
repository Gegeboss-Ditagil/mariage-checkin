// Jetons Supabase locaux (anon / service_role) signés avec le secret de test.
import { createHmac } from 'node:crypto';
export const QA_JWT_SECRET = 'qa-local-secret-qa-local-secret-qa-local-secret-0001';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
export function qaJwt(role) {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const payload = b64({ role, iss: 'supabase-qa', iat: 1700000000, exp: 4100000000 });
  const sig = createHmac('sha256', QA_JWT_SECRET).update(head + '.' + payload).digest('base64url');
  return head + '.' + payload + '.' + sig;
}
if (process.argv[2]) console.log(qaJwt(process.argv[2]));
