import { createHmac } from 'node:crypto';
import {
  GLOBAL_RATE_LIMIT_MODE,
  consumeGlobalFixedWindow,
  parseGlobalRateLimitConfig
} from './rate-limit.js';

export const IP_RATE_LIMIT_SCHEMA = 'bitevo.scope-handoff.ip-rate-limit.v1';
export const IP_RATE_LIMIT_PREFIX = 'scope-handoff/r1-rate-limit/ip/';
export const IP_RATE_LIMIT_MINUTE_MAX = 5;
export const IP_RATE_LIMIT_MINUTE_SECONDS = 60;
export const IP_RATE_LIMIT_DAY_MAX = 200;
export const IP_RATE_LIMIT_DAY_SECONDS = 86_400;

function config(maxRequests, windowSeconds) {
  const parsed = parseGlobalRateLimitConfig({
    SCOPE_HANDOFF_R1_RATE_LIMIT_MODE:GLOBAL_RATE_LIMIT_MODE,
    SCOPE_HANDOFF_R1_RATE_LIMIT_MAX_REQUESTS:String(maxRequests),
    SCOPE_HANDOFF_R1_RATE_LIMIT_WINDOW_SECONDS:String(windowSeconds)
  });
  if (!parsed.ok) throw new Error('INTERNAL_RATE_LIMIT_CONFIG_INVALID');
  return parsed.config;
}

const MINUTE_CONFIG = config(IP_RATE_LIMIT_MINUTE_MAX, IP_RATE_LIMIT_MINUTE_SECONDS);
const DAY_CONFIG = config(IP_RATE_LIMIT_DAY_MAX, IP_RATE_LIMIT_DAY_SECONDS);

export function normalizeClientIp(value) {
  if (typeof value !== 'string') return null;
  const ip = value.trim();
  if (!ip || ip.length > 128 || /[\s,]/.test(ip)) return null;
  return ip;
}

export function deriveClientBucketKey(ip, secret) {
  const normalized = normalizeClientIp(ip);
  if (!normalized || typeof secret !== 'string' || secret.length < 32) return null;
  return createHmac('sha256', secret).update(normalized).digest('hex');
}

function scopedStore(store, pathname) {
  return {
    read:() => store.read(pathname),
    createIfAbsent:(_ignored, value) => store.createIfAbsent(pathname, value),
    replaceIfMatch:(_ignored, value, etag) => store.replaceIfMatch(pathname, value, etag)
  };
}

function withProviderIo(result, extra) {
  if (!result || !Number.isSafeInteger(result.providerIo) || result.providerIo < 0) {
    return { decision:'UNKNOWN', providerIo:extra, reason:'IP_LIMIT_RESULT_INVALID' };
  }
  return { ...result, providerIo:result.providerIo + extra };
}

export function createPerIpDualWindowLimiter(options = {}) {
  const { store, ip, keySecret, now = Date.now, mutationIdFactory } = options;
  if (!store || typeof store.read !== 'function' || typeof store.createIfAbsent !== 'function' || typeof store.replaceIfMatch !== 'function') return null;
  const bucketKey = deriveClientBucketKey(ip, keySecret);
  if (!bucketKey) return null;
  const minutePath = `${IP_RATE_LIMIT_PREFIX}${bucketKey}/minute.json`;
  const dayPath = `${IP_RATE_LIMIT_PREFIX}${bucketKey}/day.json`;
  return Object.freeze({
    schema:IP_RATE_LIMIT_SCHEMA,
    bucketKey,
    async consume() {
      const minute = await consumeGlobalFixedWindow({
        store:scopedStore(store, minutePath), config:MINUTE_CONFIG, now, ...(mutationIdFactory ? { mutationIdFactory } : {})
      });
      if (minute.decision !== 'ALLOW') return minute;
      const day = await consumeGlobalFixedWindow({
        store:scopedStore(store, dayPath), config:DAY_CONFIG, now, ...(mutationIdFactory ? { mutationIdFactory } : {})
      });
      const combined = withProviderIo(day, minute.providerIo);
      if (combined.decision !== 'ALLOW') return combined;
      return { decision:'ALLOW', providerIo:combined.providerIo };
    }
  });
}

export function createCompositeScopeHandoffLimiter(...limiters) {
  const active = limiters.filter(limiter => limiter && typeof limiter.consume === 'function');
  if (active.length !== limiters.length || active.length === 0) return null;
  return Object.freeze({
    async consume() {
      let providerIo = 0;
      for (const limiter of active) {
        let result;
        try { result = await limiter.consume(); }
        catch { return { decision:'UNKNOWN', providerIo, reason:'COMPOSITE_LIMITER_THROW' }; }
        if (!result || !Number.isSafeInteger(result.providerIo) || result.providerIo < 0) {
          return { decision:'UNKNOWN', providerIo, reason:'COMPOSITE_LIMITER_RESULT_INVALID' };
        }
        providerIo += result.providerIo;
        if (result.decision === 'DENY') return { ...result, providerIo };
        if (result.decision !== 'ALLOW') return { decision:'UNKNOWN', providerIo, reason:result.reason || 'COMPOSITE_LIMITER_UNKNOWN' };
      }
      return { decision:'ALLOW', providerIo };
    }
  });
}
