import type { Env } from './types';

async function hmacSha256(key: Uint8Array | ArrayBuffer | string, message: string): Promise<Uint8Array> {
  const rawKey = typeof key === 'string' ? new TextEncoder().encode(key) : new Uint8Array(key);
  const keyData = rawKey.buffer.slice(rawKey.byteOffset, rawKey.byteOffset + rawKey.byteLength);
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return new Uint8Array(signature);
}

async function sha256Hex(message: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  return Array.from(new Uint8Array(digest))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}

function toHex(data: Uint8Array): string {
  return Array.from(data)
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}

function formatAmzDate(date: Date): { amzDate: string; shortDate: string } {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return {
    amzDate: `${yyyy}${mm}${dd}T${hh}${min}${ss}Z`,
    shortDate: `${yyyy}${mm}${dd}`
  };
}

export async function createSignedR2GetUrl(env: Env, key: string, expiresInSeconds = 60): Promise<string> {
  const accountId = env.R2_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucketName = env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error('Missing R2 signing credentials');
  }

  const now = new Date();
  const { amzDate, shortDate } = formatAmzDate(now);
  const region = 'auto';
  const service = 's3';
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const encodedKey = key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const canonicalUri = `/${bucketName}/${encodedKey}`;
  const credentialScope = `${shortDate}/${region}/${service}/aws4_request`;

  const query = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresInSeconds),
    'X-Amz-SignedHeaders': 'host'
  });

  const canonicalRequest = [
    'GET',
    canonicalUri,
    query.toString(),
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD'
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest)
  ].join('\n');

  const kDate = await hmacSha256(`AWS4${secretAccessKey}`, shortDate);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = toHex(await hmacSha256(kSigning, stringToSign));

  query.set('X-Amz-Signature', signature);

  return `https://${host}${canonicalUri}?${query.toString()}`;
}
