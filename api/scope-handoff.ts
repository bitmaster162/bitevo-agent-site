import { ipAddress, waitUntil } from '@vercel/functions';
import {
  evaluateScopeHandoffActivation,
  readScopeHandoffRuntimeEnvironment
} from '../src/lib/scope-handoff-r1/activation.js';
import {
  createCompositeScopeHandoffLimiter,
  createPerIpDualWindowLimiter
} from '../src/lib/scope-handoff-r1/admission.js';
import { handleScopeHandoffRequest } from '../src/lib/scope-handoff-r1/core.js';
import {
  createTelegramScopeHandoffNotifier,
  parseScopeHandoffTelegramConfig
} from '../src/lib/scope-handoff-r1/notify.js';
import {
  createGlobalFixedWindowLimiter,
  parseGlobalRateLimitConfig
} from '../src/lib/scope-handoff-r1/rate-limit.js';
import {
  createVercelBlobGlobalRateLimitStore,
  createVercelBlobScopeHandoffReviewQueue,
  createVercelBlobScopeHandoffStore
} from '../src/lib/scope-handoff-r1/stores.js';

type RuntimeGlobal = typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

function createConfiguredRateLimiter(env: Record<string, string | undefined> | undefined, request: Request) {
  const parsed = parseGlobalRateLimitConfig(env);
  if (!parsed.ok) return null;
  const store = createVercelBlobGlobalRateLimitStore();
  const globalLimiter = createGlobalFixedWindowLimiter({ store, config:parsed.config });
  const perIpLimiter = createPerIpDualWindowLimiter({
    store,
    ip:ipAddress(request),
    keySecret:env?.SCOPE_HANDOFF_R1_RATE_LIMIT_KEY_SECRET
  });
  return createCompositeScopeHandoffLimiter(perIpLimiter, globalLimiter);
}

function createConfiguredNotifier(env: Record<string, string | undefined> | undefined) {
  const parsed = parseScopeHandoffTelegramConfig(env);
  if (!parsed.ok) return null;
  return createTelegramScopeHandoffNotifier({
    config:parsed.config,
    schedule:promise => waitUntil(promise)
  });
}

export default {
  async fetch(request: Request) {
    const runtimeGlobal = globalThis as RuntimeGlobal;
    const env = readScopeHandoffRuntimeEnvironment(runtimeGlobal);
    const activation = evaluateScopeHandoffActivation(env);
    if (!activation.runtimeEnabled) return handleScopeHandoffRequest(request, { enabled:false });

    const rateLimiter = createConfiguredRateLimiter(env, request);
    const notifier = activation.operatorReviewEnabled ? createConfiguredNotifier(env) : null;
    return handleScopeHandoffRequest(request, {
      enabled:true,
      rateLimiter,
      notifier,
      store:rateLimiter ? createVercelBlobScopeHandoffStore() : null,
      reviewQueue:activation.operatorReviewEnabled ? createVercelBlobScopeHandoffReviewQueue() : null,
      storageOwner:activation.operatorReviewEnabled ? activation.storageOwner : null,
      retentionDays:activation.operatorReviewEnabled ? activation.retentionDays : null
    });
  }
};
