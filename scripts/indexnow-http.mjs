import https from 'node:https';

// Independent of curl's runner-specific response-header limits. HTTPS and bounded reads only.
export function requestText(uri, { method = 'GET', body = null, timeoutMs = 15000 } = {}) {
  const url = new URL(uri);
  if (url.protocol !== 'https:') throw new Error('IndexNow transport requires HTTPS');
  const requestBody = body === null ? null : Buffer.from(body, 'utf8');

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method,
      timeout: timeoutMs,
      maxHeaderSize: 128 * 1024,
      headers: {
        'user-agent': 'BitEvo-IndexNow/1.0',
        accept: '*/*',
        ...(requestBody === null ? {} : {
          'content-type': 'application/json; charset=utf-8',
          'content-length': requestBody.length
        })
      }
    }, (res) => {
      const chunks = [];
      let bytes = 0;
      res.on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes > 1024 * 1024) {
          res.destroy(new Error('IndexNow response exceeds 1 MiB'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => resolve({
        status: res.statusCode ?? 0,
        body: Buffer.concat(chunks).toString('utf8')
      }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('IndexNow HTTPS timeout')));
    req.on('error', reject);
    if (requestBody !== null) req.write(requestBody);
    req.end();
  });
}
