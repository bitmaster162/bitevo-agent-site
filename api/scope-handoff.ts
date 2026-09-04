import { handleScopeHandoffRequest } from '../src/lib/scope-handoff-r1/core.js';
import {
  createGlobalFixedWindowLimiter,
  parseGlobalRateLimitConfig
} from '../src/lib/scope-handoff-r1/rate-limit.js';
import {
  createVercelBlobGlobalRateLimitStore,
  createVercelBlobScopeHandoffStore
} from '../src/lib/scope-handoff-r1/stores.js';

type RuntimeGlobal = typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

function isScopeHandoffEnabled(runtimeGlobal: RuntimeGlobal = globalThis as RuntimeGlobal) {
  return runtimeGlobal.process?.env?.SCOPE_HANDOFF_R1_ENABLED === 'true';
}

function createConfiguredRateLimiter(env: Record<string, string | undefined> | undefined) {
  const parsed = parseGlobalRateLimitConfig(env);
  if (!parsed.ok) return null;
  return createGlobalFixedWindowLimiter({
    store:createVercelBlobGlobalRateLimitStore(),
    config:parsed.config
  });
}
export default {
  async fetch(request: Request) {
    const runtimeGlobal = globalThis as RuntimeGlobal;
    const enabled = isScopeHandoffEnabled(runtimeGlobal);
    if (!enabled) return handleScopeHandoffRequest(request, { enabled:false });

    const env = runtimeGlobal.process?.env;
    const rateLimiter = createConfiguredRateLimiter(env);
    return handleScopeHandoffRequest(request, {
      enabled:true,
      rateLimiter,
      store:rateLimiter ? createVercelBlobScopeHandoffStore() : null
    });
  }
};
