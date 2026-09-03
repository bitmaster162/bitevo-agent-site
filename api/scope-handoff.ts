import process from 'node:process';
import { handleScopeHandoffRequest } from '../src/lib/scope-handoff-r1/core.js';
import { createVercelBlobScopeHandoffStore } from '../src/lib/scope-handoff-r1/stores.js';

export default {
  async fetch(request: Request) {
    const enabled = process.env.SCOPE_HANDOFF_R1_ENABLED === 'true';
    if (!enabled) return handleScopeHandoffRequest(request, { enabled:false });
    const store = createVercelBlobScopeHandoffStore();
    return handleScopeHandoffRequest(request, { enabled:true, store });
  }
};
