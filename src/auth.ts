import type { Env } from './types';
import { hasSessionCookie } from './utils';

export function isAuthorized(request: Request, env: Env): boolean {
  const cfAccessEmail = request.headers.get('CF-Access-Authenticated-User-Email');
  const domain = env.ADMIN_EMAIL_DOMAIN?.trim();

  if (cfAccessEmail && domain) {
    return cfAccessEmail.endsWith(`@${domain}`);
  }

  if (cfAccessEmail && !domain) {
    return true;
  }

  return hasSessionCookie(request.headers.get('cookie'));
}

export async function verifyPassword(request: Request, env: Env): Promise<boolean> {
  const form = await request.formData();
  const password = form.get('password');
  return typeof password === 'string' && password.length > 0 && password === env.ADMIN_PASSWORD;
}
