const canonicalGuides = new Set([
  '/guides/ai-agent-reliability-audit',
  '/guides/security-sandboxing',
  '/guides/fleet-coordinator-drift-monitoring',
  '/guides/d3-tool-io-bridge-contract'
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';

    if (path.startsWith('/guides/') && !canonicalGuides.has(path)) {
      return Response.redirect(new URL('/guides', url), 302);
    }

    return env.ASSETS.fetch(request);
  }
};
