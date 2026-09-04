import { BlobPreconditionFailedError, get, put } from '@vercel/blob';

export class InMemoryScopeHandoffStore {
  constructor() {
    this.records = new Map();
    this.readCount = 0;
    this.writeCount = 0;
    this.failRead = false;
    this.failWrite = false;
  }
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
function isCasConflict(error) {
  if (error instanceof BlobPreconditionFailedError) return true;
  const status = error?.statusCode ?? error?.status;
  const code = String(error?.code || error?.name || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return status === 409 || status === 412 ||
    code.includes('precondition') || code.includes('already_exists') || code.includes('alreadyexists') ||
    message.includes('precondition') || message.includes('already exists');
}

async function readJsonBlob(pathname) {
  try {
    const result = await get(pathname, { access:'private', useCache:false });
    if (!result) return null;
    const text = await new Response(result.stream).text();
    return { value:JSON.parse(text), etag:result.blob.etag };
  } catch (error) {
    if (isMissingBlob(error)) return null;
    throw error;
  }
}

export function createVercelBlobScopeHandoffStore() {
  const read = async pathname => {
    const snapshot = await readJsonBlob(pathname);
    return snapshot?.value ?? null;
  };
  return {
    read,
    async createIfAbsent(pathname, record) {
      try {
        await put(pathname, JSON.stringify(record), {
          access:'private', addRandomSuffix:false, allowOverwrite:false,
          contentType:'application/json; charset=utf-8'
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

export function createVercelBlobGlobalRateLimitStore() {
  return {
    read:readJsonBlob,
    async createIfAbsent(pathname, state) {
      try {
        await put(pathname, JSON.stringify(state), {
          access:'private', addRandomSuffix:false, allowOverwrite:false,
          contentType:'application/json; charset=utf-8'
        });
        return { created:true };
      } catch (error) {
        if (isCasConflict(error)) return { created:false };
        throw error;
      }
    },
    async replaceIfMatch(pathname, state, etag) {
      try {
        await put(pathname, JSON.stringify(state), {
          access:'private', addRandomSuffix:false, allowOverwrite:true, ifMatch:etag,
          contentType:'application/json; charset=utf-8'
        });
        return { replaced:true };
      } catch (error) {
        if (isCasConflict(error)) return { replaced:false };
        throw error;
      }
    }
  };
}
