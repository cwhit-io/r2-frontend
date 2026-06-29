import worker from '../src/index';
import type { Env, FileRecord } from '../src/types';
import { describe, expect, it } from 'vitest';

class MockD1 {
  private files = new Map<string, FileRecord>();
  public downloadEvents: Array<{ file_id: string; ip_hash: string }> = [];

  prepare(query: string) {
    return new MockPrepared(query, this.files, this.downloadEvents);
  }
}

class MockPrepared {
  private values: unknown[] = [];

  constructor(
    private readonly query: string,
    private readonly files: Map<string, FileRecord>,
    private readonly downloadEvents: Array<{ file_id: string; ip_hash: string }>
  ) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async all<T>() {
    if (this.query.includes('SELECT id, filename, r2_key, uploader, created_at, downloads FROM files ORDER BY')) {
      return { results: Array.from(this.files.values()) as T[] };
    }
    return { results: [] as T[] };
  }

  async first<T>() {
    if (this.query.includes('SELECT id, filename, r2_key, uploader, created_at, downloads FROM files WHERE id = ?1')) {
      const id = this.values[0] as string;
      return (this.files.get(id) ?? null) as T | null;
    }
    return null;
  }

  async run() {
    if (this.query.includes('INTO files') && this.query.startsWith('INSERT')) {
      const [id, filename, r2_key, uploader] = this.values as [string, string, string, string];
      this.files.set(id, {
        id,
        filename,
        r2_key,
        uploader,
        created_at: new Date().toISOString(),
        downloads: 0
      });
      return {};
    }

    if (this.query.startsWith('UPDATE files SET downloads = downloads + 1')) {
      const id = this.values[0] as string;
      const row = this.files.get(id);
      if (row) {
        row.downloads += 1;
        this.files.set(id, row);
      }
      return {};
    }

    if (this.query.startsWith('DELETE FROM files')) {
      const id = this.values[0] as string;
      this.files.delete(id);
      return {};
    }

    if (this.query.startsWith('INSERT INTO downloads')) {
      const [file_id, ip_hash] = this.values as [string, string];
      this.downloadEvents.push({ file_id, ip_hash });
      return {};
    }

    return {};
  }
}

class MockR2 {
  public objects = new Map<string, Uint8Array>();

  async put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string) {
    if (value instanceof ReadableStream) {
      const reader = value.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        chunks.push(chunk);
      }
      const merged = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      this.objects.set(key, merged);
      return;
    }
    this.objects.set(key, new TextEncoder().encode(String(value)));
  }

  async delete(key: string) {
    this.objects.delete(key);
  }
}

interface TestEnv extends Env {
  __db: MockD1;
}

function createEnv(): TestEnv {
  const db = new MockD1();
  return {
    DB: db as unknown as D1Database,
    FILES: new MockR2() as unknown as R2Bucket,
    ADMIN_PASSWORD: 'secret',
    ADMIN_EMAIL_DOMAIN: 'example.com',
    R2_ACCOUNT_ID: 'account123',
    R2_ACCESS_KEY_ID: 'access123',
    R2_SECRET_ACCESS_KEY: 'secret123',
    R2_BUCKET_NAME: 'files',
    __db: db
  };
}

describe('worker', () => {
  it('uploads a file and returns a public url', async () => {
    const env = createEnv();
    const form = new FormData();
    form.set('file', new File(['hello'], 'hello.txt', { type: 'text/plain' }));

    const response = await worker.fetch(
      new Request('https://app.example.com/api/upload', {
        method: 'POST',
        body: form,
        headers: { 'CF-Access-Authenticated-User-Email': 'alice@example.com' }
      }),
      env
    );

    expect(response.status).toBe(201);
    const json = (await response.json()) as { id: string; publicUrl: string }[];
    expect(json[0]?.id).toMatch(/^[a-z0-9]{12}$/);
    expect(json[0]?.publicUrl).toMatch(/^https:\/\/app\.example\.com\/d\/[a-z0-9]{12}$/);
  });

  it('increments download count before redirecting', async () => {
    const env = createEnv();
    const form = new FormData();
    form.set('file', new File(['hello'], 'hello.txt', { type: 'text/plain' }));

    const uploadResponse = await worker.fetch(
      new Request('https://app.example.com/api/upload', {
        method: 'POST',
        body: form,
        headers: { 'CF-Access-Authenticated-User-Email': 'alice@example.com' }
      }),
      env
    );
    const [{ id }] = (await uploadResponse.json()) as { id: string }[];

    const downloadResponse = await worker.fetch(new Request(`https://app.example.com/d/${id}`), env);

    expect(downloadResponse.status).toBe(302);

    const filesResponse = await worker.fetch(
      new Request('https://app.example.com/api/files', {
        headers: { 'CF-Access-Authenticated-User-Email': 'alice@example.com' }
      }),
      env
    );
    const files = (await filesResponse.json()) as FileRecord[];
    expect(files[0]?.downloads).toBe(1);
    expect(env.__db.downloadEvents).toHaveLength(1);
    expect(env.__db.downloadEvents[0]?.file_id).toBe(id);
  });

  it('preserves download count when re-uploading file with same name', async () => {
    const env = createEnv();
    const form1 = new FormData();
    form1.set('file', new File(['hello'], 'hello.txt', { type: 'text/plain' }));

    // Upload first file
    const uploadResponse1 = await worker.fetch(
      new Request('https://app.example.com/api/upload', {
        method: 'POST',
        body: form1,
        headers: { 'CF-Access-Authenticated-User-Email': 'alice@example.com' }
      }),
      env
    );
    const [{ id: id1 }] = (await uploadResponse1.json()) as { id: string }[];

    // Download the file to increment count
    await worker.fetch(new Request(`https://app.example.com/d/${id1}`), env);

    // Upload second file with same name (should create a new file entry)
    const form2 = new FormData();
    form2.set('file', new File(['world'], 'hello.txt', { type: 'text/plain' }));
    const uploadResponse2 = await worker.fetch(
      new Request('https://app.example.com/api/upload', {
        method: 'POST',
        body: form2,
        headers: { 'CF-Access-Authenticated-User-Email': 'alice@example.com' }
      }),
      env
    );
    const [{ id: id2 }] = (await uploadResponse2.json()) as { id: string }[];

    // Both files should exist with different IDs
    expect(id1).not.toBe(id2);

    const filesResponse = await worker.fetch(
      new Request('https://app.example.com/api/files', {
        headers: { 'CF-Access-Authenticated-User-Email': 'alice@example.com' }
      }),
      env
    );
    const files = (await filesResponse.json()) as FileRecord[];
    
    // Download count should be preserved on first file
    const file1 = files.find(f => f.id === id1);
    expect(file1?.downloads).toBe(1);
    
    // Second file should have 0 downloads
    const file2 = files.find(f => f.id === id2);
    expect(file2?.downloads).toBe(0);
  });
});
