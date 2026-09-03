import { get, put } from '@vercel/blob';

export class InMemoryScopeHandoffStore {
  constructor() { this.records = new Map(); this.readCount = 0; this.writeCount = 0; this.failRead = false; this.failWrite = false; }
  async read(pathname) {
    this.readCount += 1;
    if (this.failRead) throw new Error('FAKE_READ_UNCERTAIN');
    const value = this.records.get(pathname);
    return value ? structuredClone(value) : null;
  }
  async createIfAbsent(pathname, record) {
    this.writeCount += 1;
    if (this.failWrite) throw new Error('FAKE_WRITE_UNCERTAIN');
    if (this.records.has(pathname)) return { created:false };
    this.records.set(pathname, structuredClone(record));
    return { created:true };
  }
}

function isMissingBlob(error) {
  const status = error?.statusCode ?? error?.status;
  const code = String(error?.code || error?.name || '').toLowerCase();
  return status === 404 || code.includes('notfound') || code.includes('not_found');
}

export function createVercelBlobScopeHandoffStore() {
  const read = async pathname => {
    try {
      const result = await get(pathname, { access:'private' });
      if (!result) return null;
      const text = await new Response(result.stream).text();
      return JSON.parse(text);
    } catch (error) {
      if (isMissingBlob(error)) return null;
      throw error;
    }
  };
  return {
    read,
    async createIfAbsent(pathname, record) {
      try {
        await put(pathname, JSON.stringify(record), {
          access:'private', addRandomSuffix:false, allowOverwrite:false,
          contentType:'application/json; charset=utf-8', cacheControlMaxAge:0
        });
        return { created:true };
      } catch (error) {
        const existing = await read(pathname);
        if (existing) return { created:false };
        throw error;
      }
    }
  };
}
