import { z } from 'zod';
import { isAuthorized, verifyPassword } from './auth';
import { renderAdmin, renderFilesTable, renderLogin } from './templates';
import type { Env, FileRecord } from './types';
import { generateFileId, getPublicUrl, getR2Key, getSessionCookieHeader, sha256Hex } from './utils';

const idSchema = z.string().regex(/^[a-z0-9]{12}$/);

async function listFiles(env: Env): Promise<FileRecord[]> {
  const result = await env.DB.prepare(
    'SELECT id, filename, r2_key, uploader, created_at, downloads FROM files ORDER BY created_at DESC'
  ).all<FileRecord>();
  return result.results ?? [];
}

async function getFile(env: Env, id: string): Promise<FileRecord | null> {
  const result = await env.DB.prepare(
    'SELECT id, filename, r2_key, uploader, created_at, downloads FROM files WHERE id = ?1'
  )
    .bind(id)
    .first<FileRecord>();
  return result ?? null;
}

function isHtmx(request: Request): boolean {
  return request.headers.get('HX-Request') === 'true';
}

function unauthorized(): Response {
  return new Response('Unauthorized', { status: 401 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/login' && request.method === 'POST') {
      const isValid = await verifyPassword(request, env);
      return new Response(null, {
        status: 302,
        headers: {
          location: '/',
          'set-cookie': getSessionCookieHeader(isValid)
        }
      });
    }

    if (url.pathname === '/logout' && request.method === 'POST') {
      return new Response(null, {
        status: 302,
        headers: {
          location: '/',
          'set-cookie': getSessionCookieHeader(false)
        }
      });
    }

    if (url.pathname === '/d' || url.pathname.startsWith('/d/')) {
      const id = url.pathname.split('/').at(-1) ?? '';
      if (!idSchema.safeParse(id).success) {
        return new Response('Invalid file id', { status: 400 });
      }

      const record = await getFile(env, id);
      if (!record) {
        return new Response('Not found', { status: 404 });
      }

      await env.DB.prepare('UPDATE files SET downloads = downloads + 1 WHERE id = ?1').bind(id).run();
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      await env.DB.prepare('INSERT INTO downloads (file_id, ip_hash) VALUES (?1, ?2)').bind(id, await sha256Hex(ip)).run();

      return Response.redirect(getPublicUrl(record.r2_key), 302);
    }

    if (url.pathname.startsWith('/files/') && request.method === 'GET') {
      const filename = decodeURIComponent(url.pathname.slice('/files/'.length));
      if (!filename) return new Response('Not found', { status: 404 });
      const obj = await env.FILES.get(`files/${filename}`);
      if (!obj) return new Response('Not found', { status: 404 });
      const headers = new Headers();
      obj.writeHttpMetadata(headers);
      headers.set('etag', obj.httpEtag);
      return new Response(obj.body, { headers });
    }

    if (!isAuthorized(request, env)) {
      if (url.pathname === '/') {
        return renderLogin();
      }
      return unauthorized();
    }

    if (url.pathname === '/' && request.method === 'GET') {
      const records = await listFiles(env);
      return renderAdmin(records, url.origin);
    }

    if (url.pathname === '/api/files' && request.method === 'GET') {
      const records = await listFiles(env);
      return Response.json(records);
    }

    if (url.pathname === '/api/files-table' && request.method === 'GET') {
      const records = await listFiles(env);
      return new Response(renderFilesTable(records, url.origin), {
        headers: { 'content-type': 'text/html; charset=utf-8' }
      });
    }

    if (url.pathname === '/api/upload' && request.method === 'POST') {
      const formData = await request.formData();

      const validFiles = formData.getAll('file').filter((f): f is File => f instanceof File && f.size > 0);
      if (validFiles.length === 0) {
        return new Response('No valid files provided', { status: 400 });
      }

      const results: { id: string; publicUrl: string }[] = [];
      for (const file of validFiles) {
        const id = generateFileId();
        const key = getR2Key(id, file.name);
        await env.FILES.put(key, file.stream(), {
          httpMetadata: {
            contentType: file.type || 'application/octet-stream'
          }
        });
        await env.DB.prepare('INSERT OR REPLACE INTO files (id, filename, r2_key, uploader) VALUES (?1, ?2, ?3, ?4)')
          .bind(id, file.name, key, '')
          .run();
        results.push({ id, publicUrl: `${url.origin}/d/${id}` });
      }

      if (isHtmx(request)) {
        const records = await listFiles(env);
        return new Response(renderFilesTable(records, url.origin), {
          headers: { 'content-type': 'text/html; charset=utf-8' }
        });
      }

      return Response.json(results, { status: 201 });
    }

    if (url.pathname.startsWith('/api/files/') && request.method === 'DELETE') {
      const id = url.pathname.replace('/api/files/', '');
      if (!idSchema.safeParse(id).success) {
        return new Response('Invalid file id', { status: 400 });
      }

      const record = await getFile(env, id);
      if (!record) {
        return new Response('Not found', { status: 404 });
      }

      await env.FILES.delete(record.r2_key);
      await env.DB.prepare('DELETE FROM files WHERE id = ?1').bind(id).run();

      if (isHtmx(request)) {
        const records = await listFiles(env);
        return new Response(renderFilesTable(records, url.origin), {
          headers: { 'content-type': 'text/html; charset=utf-8' }
        });
      }

      return new Response(null, { status: 204 });
    }

    return new Response('Not found', { status: 404 });
  }
};
