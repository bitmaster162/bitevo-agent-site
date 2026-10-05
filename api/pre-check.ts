import { ipAddress } from '@vercel/functions';
import { handlePreCheckRequest } from '../src/lib/pre-check-r1/core.js';
import {
  parsePreCheckRuntimeConfig,
  readPreCheckRuntimeEnvironment
} from '../src/lib/pre-check-r1/config.js';
import { createOpenRouterPreCheckProvider } from '../src/lib/pre-check-r1/openrouter.js';
import { createPreCheckRateLimiter } from '../src/lib/pre-check-r1/rate-limit.js';
import { createVercelBlobGlobalRateLimitStore } from '../src/lib/scope-handoff-r1/stores.js';

type RuntimeGlobal = typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

function configFailure() {
  return new Response(JSON.stringify({ error:'PRECHECK_CONFIG_INVALID' }), {
    status:503,
    headers:{
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'no-store',
      'X-Robots-Tag':'noindex',
      'X-Content-Type-Options':'nosniff'
    }
  });
}

export default {
  async fetch(request: Request) {
    const runtimeGlobal = globalThis as RuntimeGlobal;
    const env = readPreCheckRuntimeEnvironment(runtimeGlobal);
    const config = parsePreCheckRuntimeConfig(env);
    if (!config.enabled) return handlePreCheckRequest(request, { enabled:false });
    if (!config.ok || config.dailyLimit === null) return configFailure();

    const store = createVercelBlobGlobalRateLimitStore();
    const limiter = createPreCheckRateLimiter({
      store,
      ip:ipAddress(request),
      keySecret:config.keySecret,
      dailyLimit:config.dailyLimit
    });
    if (!limiter) return configFailure();

    const provider = config.providerConfigured
      ? createOpenRouterPreCheckProvider({
          apiKey:config.apiKey,
          models:config.models
        })
      : null;

    return handlePreCheckRequest(request, {
      enabled:true,
      limiter,
      provider
    });
  }
};
