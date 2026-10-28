// R50-H isolated staging Worker. No public assets, redirects, or production routes.
// Both handlers share one uniquely named R50-H D1 binding; disabled by default.
import {handleR50GrantClaim} from './r50-grant-claim.mjs';
import {handleBitEvoWorkerEvent} from './r50-event-dedup-candidate.mjs';
const reply = () => new Response(JSON.stringify({ok:false,error:'NOT_FOUND'}),{
 status:404,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Robots-Tag':'noindex'}
});
export default {
 fetch(request, env) {
  const url=new URL(request.url);
  if(url.search || url.hash || request.method !== 'POST') return reply();
  if(url.pathname==='/r50/claim') return handleR50GrantClaim(request,{
   BITEVO_R50_GRANT_DB:env.BITEVO_R50_STAGING_DB,
   BITEVO_R50_GRANT_RECEIVER_ENABLED:env.BITEVO_R50_GRANT_RECEIVER_ENABLED,
   BITEVO_EVENT_COUNTER_SIGNING_SECRET:env.BITEVO_EVENT_COUNTER_SIGNING_SECRET
  });
  if(url.pathname==='/b1-2/event') return handleBitEvoWorkerEvent(request,{
   BITEVO_EVENT_DB:env.BITEVO_R50_STAGING_DB,
   BITEVO_EVENT_RATE_LIMITER:env.BITEVO_EVENT_RATE_LIMITER,
   BITEVO_EVENT_COUNTER_RECEIVER_ENABLED:env.BITEVO_EVENT_COUNTER_RECEIVER_ENABLED,
   BITEVO_EVENT_COUNTER_SIGNING_SECRET:env.BITEVO_EVENT_COUNTER_SIGNING_SECRET
  });
  return reply();
 }
};
