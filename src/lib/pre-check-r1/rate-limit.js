import { deriveClientBucketKey } from '../scope-handoff-r1/admission.js';
import {
  GLOBAL_RATE_LIMIT_MODE,
  consumeGlobalFixedWindow,
  globalRateLimitConfigurationDigest
} from '../scope-handoff-r1/rate-limit.js';
import { PRECHECK_R1_DAILY_WINDOW_SECONDS } from './config.js';

export const PRECHECK_R1_IP_HOUR_MAX = 5;
export const PRECHECK_R1_IP_HOUR_SECONDS = 3_600;
export const PRECHECK_R1_RATE_LIMIT_PREFIX = 'pre-check/r1-rate-limit/';
export const PRECHECK_R1_GLOBAL_DAY_PATH = `${PRECHECK_R1_RATE_LIMIT_PREFIX}global/day.json`;

function fixedConfig(maxRequests, windowSeconds) {
  return Object.freeze({
    mode:GLOBAL_RATE_LIMIT_MODE,
    maxRequests,
    windowSeconds,
    windowMs:windowSeconds * 1000,
    configurationDigest:globalRateLimitConfigurationDigest(maxRequests, windowSeconds)
  });
}

function scopedStore(store, pathname) {
  return Object.freeze({
    read:() => store.read(pathname),
    createIfAbsent:(_ignored, value) => store.createIfAbsent(pathname, value),
    replaceIfMatch:(_ignored, value, etag) => store.replaceIfMatch(pathname, value, etag)
  });
}

function addIo(result, extra) {
  if (!result || !Number.isSafeInteger(result.providerIo) || result.providerIo < 0) {
    return { decision:'UNKNOWN', providerIo:extra, reason:'LIMIT_RESULT_INVALID' };
  }
  return { ...result, providerIo:result.providerIo + extra };
}

export function createPreCheckRateLimiter(options = {}) {
  const { store, ip, keySecret, dailyLimit, now = Date.now, mutationIdFactory } = options;
  if (!store || typeof store.read !== 'function' || typeof store.createIfAbsent !== 'function' ||
      typeof store.replaceIfMatch !== 'function') return null;
  if (!Number.isSafeInteger(dailyLimit) || dailyLimit < 1) return null;
  const bucketKey = deriveClientBucketKey(ip, keySecret);
  if (!bucketKey) return null;
  const hourConfig = fixedConfig(PRECHECK_R1_IP_HOUR_MAX, PRECHECK_R1_IP_HOUR_SECONDS);
  const dayConfig = fixedConfig(dailyLimit, PRECHECK_R1_DAILY_WINDOW_SECONDS);
  const hourPath = `${PRECHECK_R1_RATE_LIMIT_PREFIX}ip/${bucketKey}/hour.json`;
  return Object.freeze({
    bucketKey,
    hourPath,
    globalDayPath:PRECHECK_R1_GLOBAL_DAY_PATH,
    async consume() {
      const hour = await consumeGlobalFixedWindow({
        store:scopedStore(store, hourPath),
        config:hourConfig,
        now,
        ...(mutationIdFactory ? { mutationIdFactory } : {})
      });
      if (hour.decision !== 'ALLOW') return hour;
      const day = await consumeGlobalFixedWindow({
        store:scopedStore(store, PRECHECK_R1_GLOBAL_DAY_PATH),
        config:dayConfig,
        now,
        ...(mutationIdFactory ? { mutationIdFactory } : {})
      });
      return addIo(day, hour.providerIo);
    }
  });
}
