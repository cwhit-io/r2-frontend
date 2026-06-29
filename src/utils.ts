const ID_LENGTH = 12;
const SESSION_COOKIE = 'session=ok; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400';
const LOGOUT_COOKIE = 'session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0';

export function generateFileId(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const out: string[] = [];
  const maxUnbiased = Math.floor(256 / alphabet.length) * alphabet.length;

  while (out.length < ID_LENGTH) {
    const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH));
    for (const value of bytes) {
      if (value >= maxUnbiased) continue;
      out.push(alphabet[value % alphabet.length]);
      if (out.length === ID_LENGTH) break;
    }
  }

  return out.join('');
}

export function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 160) || 'file';
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

export function getPublicUrl(r2Key: string): string {
  return `https://b1-storage.bhm.li/${r2Key}`;
}

export function getR2Key(id: string, filename: string): string {
  const sanitized = sanitizeFilename(filename);
  const ext = sanitized.includes('.') ? sanitized.slice(sanitized.lastIndexOf('.')) : '';
  return ext ? `files/${id}${ext}` : `files/${id}/${sanitized}`;
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
