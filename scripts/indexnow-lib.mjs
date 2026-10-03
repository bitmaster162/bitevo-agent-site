export function changedRoutePaths(previous, current, { bootstrap = false } = {}) {
  if (!current || current.schema !== 'bitevo.sitemap-currentness/v1' || !Array.isArray(current.routes)) {
    throw new Error('current sitemap-currentness manifest is invalid');
  }
  if (previous && (previous.schema !== 'bitevo.sitemap-currentness/v1' || !Array.isArray(previous.routes))) {
    throw new Error('previous sitemap-currentness manifest is invalid');
  }

  const currentByPath = new Map(current.routes.map(row => [row.path, row]));
  if (bootstrap || !previous) return [...currentByPath.keys()].sort((a, b) => a.localeCompare(b));

  const previousByPath = new Map(previous.routes.map(row => [row.path, row]));
  const allPaths = new Set([...previousByPath.keys(), ...currentByPath.keys()]);
  return [...allPaths]
    .filter(path => {
      const oldRow = previousByPath.get(path);
      const newRow = currentByPath.get(path);
      if (!oldRow || !newRow) return true;
      return oldRow.fingerprint !== newRow.fingerprint;
    })
    .sort((a, b) => a.localeCompare(b));
}

export function buildIndexNowPayload(config, paths) {
  if (!config || config.schema !== 'bitevo.indexnow/v1') throw new Error('IndexNow config schema is invalid');
  if (!Array.isArray(paths)) throw new Error('IndexNow paths must be an array');
  if (paths.length > 10000) throw new Error(`IndexNow URL batch exceeds protocol limit: ${paths.length}`);

  const urlList = paths.map(path => new URL(path, config.origin).toString());
  for (const url of urlList) {
    const parsed = new URL(url);
    if (parsed.host !== config.host || parsed.origin !== config.origin) {
      throw new Error(`IndexNow URL escaped configured host: ${url}`);
    }
  }

  return {
    host: config.host,
    key: config.key,
    keyLocation: config.keyLocation,
    urlList,
  };
}
