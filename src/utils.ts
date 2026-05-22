const ID_LENGTH = 12;
const SESSION_COOKIE = 'session=ok; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400';
const LOGOUT_COOKIE = 'session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0';

export function generateFileId(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(ID_LENGTH)))
    .map((value) => alphabet[value % alphabet.length])
    .join('');
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160) || 'file';
}

export function getSessionCookieHeader(authenticated: boolean): string {
  return authenticated ? SESSION_COOKIE : LOGOUT_COOKIE;
}

export function hasSessionCookie(cookieHeader: string | null): boolean {
  return Boolean(cookieHeader?.split(';').map((part) => part.trim()).find((part) => part === 'session=ok'));
}

export function htmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function getPublicUrl(origin: string, id: string): string {
  return `${origin}/d/${id}`;
}

export function getR2Key(id: string, filename: string): string {
  return `${id}/${sanitizeFilename(filename)}`;
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
