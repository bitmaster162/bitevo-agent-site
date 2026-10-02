export const SCOPE_HANDOFF_NOTIFICATION_SCHEMA = 'bitevo.scope-handoff.notification.v1';

function readExact(env, key) {
  try {
    const value = env && typeof env === 'object' ? env[key] : undefined;
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

export function parseScopeHandoffTelegramConfig(env = {}) {
  const enabled = readExact(env, 'SCOPE_HANDOFF_R1_NOTIFICATION_ENABLED') === 'true';
  const botToken = readExact(env, 'SCOPE_HANDOFF_R1_TELEGRAM_BOT_TOKEN');
  const chatId = readExact(env, 'SCOPE_HANDOFF_R1_TELEGRAM_CHAT_ID');
  const tokenOk = /^\d{5,15}:[A-Za-z0-9_-]{20,}$/.test(botToken);
  const chatOk = /^-?\d{5,20}$/.test(chatId);
  return Object.freeze({
    ok:enabled && tokenOk && chatOk,
    checks:Object.freeze({ enabled, botToken:tokenOk, chatId:chatOk }),
    config:enabled && tokenOk && chatOk ? Object.freeze({ botToken, chatId }) : null
  });
}

export function buildScopeHandoffNotification(record) {
  if (!record || typeof record !== 'object') return null;
  const requestId = typeof record.submission_id === 'string' ? record.submission_id : '';
  const receivedAt = typeof record.accepted_at === 'string' ? record.accepted_at : '';
  const locale = record.locale === 'ru' ? 'ru' : record.locale === 'en' ? 'en' : '';
  const offer = typeof record.request?.offer === 'string' && record.request.offer
    ? record.request.offer
    : record.intake_depth === 'primary' ? 'primary_audit' : record.intake_depth === 'entry' ? 'entry_audit' : 'scope_review';
  if (!requestId || !receivedAt || !locale) return null;
  return `BitEvo: new request · ${requestId} · ${receivedAt} · ${offer} · ${locale}`;
}

export function createTelegramScopeHandoffNotifier(options = {}) {
  const { config, fetchImpl = globalThis.fetch, schedule = null } = options;
  if (!config || typeof config.botToken !== 'string' || typeof config.chatId !== 'string' || typeof fetchImpl !== 'function') return null;
  return Object.freeze({
    schema:SCOPE_HANDOFF_NOTIFICATION_SCHEMA,
    notify(record) {
      const text = buildScopeHandoffNotification(record);
      if (!text) return { scheduled:false, reason:'RECORD_METADATA_INVALID' };
      const task = Promise.resolve().then(async () => {
        const response = await fetchImpl(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body:JSON.stringify({ chat_id:config.chatId, text, disable_web_page_preview:true })
        });
        if (!response || response.ok !== true) throw new Error('TELEGRAM_NOTIFY_REJECTED');
        return true;
      });
      if (typeof schedule === 'function') {
        schedule(task.catch(() => false));
        return { scheduled:true };
      }
      task.catch(() => false);
      return { scheduled:true };
    }
  });
}
