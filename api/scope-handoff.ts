import { handleScopeHandoffRequest } from '../src/lib/scope-handoff-r1/core.js';
import { createVercelBlobScopeHandoffStore } from '../src/lib/scope-handoff-r1/stores.js';

type RuntimeGlobal = typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

function isScopeHandoffEnabled(runtimeGlobal: RuntimeGlobal = globalThis as RuntimeGlobal) {
  return runtimeGlobal.process?.env?.SCOPE_HANDOFF_R1_ENABLED === 'true';
}

export default {
  async fetch(request: Request) {
    const enabled = isScopeHandoffEnabled();
    if (!enabled) return handleScopeHandoffRequest(request, { enabled:false });
    const store = createVercelBlobScopeHandoffStore();
    return handleScopeHandoffRequest(request, { enabled:true, store });
  }
};
