import type { FileRecord } from './types';
import { getPublicUrl, htmlEscape } from './utils';

function page(title: string, body: string): Response {
  return new Response(`<!doctype html>
<html lang=\"en\">
<head>
  <meta charset=\"utf-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
  <title>${title}</title>
  <script src=\"https://unpkg.com/htmx.org@1.9.12\"></script>
  <script src=\"https://cdn.tailwindcss.com\"></script>
</head>
<body class=\"bg-slate-50 text-slate-900\">${body}</body>
</html>`, {
    headers: { 'content-type': 'text/html; charset=utf-8' }
  });
}

export function renderLogin(): Response {
  return page(
    'Login',
    `<main class=\"max-w-md mx-auto mt-20 p-6 bg-white rounded-lg shadow\">
      <h1 class=\"text-xl font-semibold mb-4\">Internal File Host</h1>
      <form action=\"/login\" method=\"post\" class=\"space-y-3\">
        <label class=\"block text-sm font-medium\">Password</label>
        <input name=\"password\" type=\"password\" class=\"w-full border rounded px-3 py-2\" required />
        <button class=\"w-full bg-indigo-600 text-white rounded px-3 py-2\" type=\"submit\">Sign in</button>
      </form>
    </main>`
  );
}

export function renderAdmin(records: FileRecord[], origin: string): Response {
  return page(
    'Admin',
    `<main class=\"max-w-5xl mx-auto px-4 py-8\">
      <div class=\"flex items-center justify-between mb-6\">
        <h1 class=\"text-2xl font-semibold\">Internal File Host</h1>
        <form action=\"/logout\" method=\"post\"><button class=\"text-sm text-slate-600 underline\">Logout</button></form>
      </div>

      <section class=\"bg-white rounded-lg shadow p-4 mb-6\">
        <h2 class=\"text-lg font-medium mb-3\">Upload file</h2>
        <form id=\"upload-form\" class=\"space-y-3\" hx-post=\"/api/upload\" hx-encoding=\"multipart/form-data\" hx-target=\"#files-table\" hx-swap=\"outerHTML\" enctype=\"multipart/form-data\">
          <input name=\"uploader\" placeholder=\"Uploader name\" class=\"border rounded px-3 py-2 w-full max-w-xs\" required />
          <div class=\"border-2 border-dashed border-slate-300 rounded p-5\">
            <input name=\"file\" type=\"file\" required class=\"w-full\" />
          </div>
          <button class=\"bg-indigo-600 text-white rounded px-4 py-2\" type=\"submit\">Upload</button>
        </form>
      </section>

      ${renderFilesTable(records, origin)}
    </main>`
  );
}

export function renderFilesTable(records: FileRecord[], origin: string): string {
  const rows = records
    .map((record) => {
      const publicUrl = htmlEscape(getPublicUrl(origin, record.id));
      return `<tr class=\"border-t\">
        <td class=\"px-3 py-2\">${htmlEscape(record.filename)}</td>
        <td class=\"px-3 py-2\">${htmlEscape(record.created_at)}</td>
        <td class=\"px-3 py-2\">${record.downloads}</td>
        <td class=\"px-3 py-2\"><code class=\"text-xs\">${publicUrl}</code></td>
        <td class=\"px-3 py-2\">
          <div class=\"flex gap-2\">
            <button class=\"text-xs bg-slate-700 text-white rounded px-2 py-1\" onclick=\"navigator.clipboard.writeText('${publicUrl}')\" type=\"button\">Copy link</button>
            <button class=\"text-xs bg-red-600 text-white rounded px-2 py-1\" hx-delete=\"/api/files/${record.id}\" hx-target=\"#files-table\" hx-swap=\"outerHTML\">Delete</button>
          </div>
        </td>
      </tr>`;
    })
    .join('');

  return `<section id=\"files-table\" class=\"bg-white rounded-lg shadow overflow-hidden\">
    <table class=\"min-w-full text-sm\">
      <thead class=\"bg-slate-100\"><tr><th class=\"text-left px-3 py-2\">Filename</th><th class=\"text-left px-3 py-2\">Created</th><th class=\"text-left px-3 py-2\">Downloads</th><th class=\"text-left px-3 py-2\">Public URL</th><th class=\"text-left px-3 py-2\">Actions</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}
