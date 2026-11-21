/* Optional GA4 page views on the public production origin. */
(() => {
  'use strict';
  if (location.origin !== 'https://bitevo.work') return;
  const footer = document.querySelector('.site-footer .footer-shell');
  if (!footer || footer.querySelector('[data-ga-preferences]')) return;

  const measurementId = 'G-3XTVGVN2P5';
  const consentKey = 'bitevo.ga4.preference.v1';
  const cookiePrefix = 'bitevoGa4';
  const maxAge = 180 * 24 * 60 * 60;
  const ru = document.documentElement.lang === 'ru';
  let started = false;
  let withdrawn = false;
  const deniedCookie = 'bitevoGa4Denied';

  function choice() {
    try {
      if (withdrawn || document.cookie.split(';').some(value => value.trim() === deniedCookie + '=1')) return false;
      const raw = localStorage.getItem(consentKey);
      const saved = JSON.parse(raw);
      if (saved?.allow !== true || !Number.isFinite(saved.at) || saved.at > Date.now() || Date.now() - saved.at >= maxAge * 1000) return false;
      // A previously granted read-only record cannot reactivate the tag after withdrawal.
      localStorage.setItem(consentKey, raw);
      return true;
    } catch { /* Privacy controls may disable local storage. */ }
    return false;
  }

  function clearCookies() {
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.split('=')[0].trim();
      if (name.startsWith(cookiePrefix + '_')) document.cookie = name + '=; Path=/; Max-Age=0; Secure; SameSite=Lax';
    }
  }

  function sync() {
    const allow = choice() && navigator.globalPrivacyControl !== true && navigator.doNotTrack !== '1';
    status.textContent = allow ? (ru ? 'Включена.' : 'On.') : (ru ? 'Выключена.' : 'Off.');
    window['ga-disable-' + measurementId] = !allow;
    if (!allow) {
      clearCookies();
      if (started) location.reload();
      return;
    }
    const canonical = document.querySelector('link[rel="canonical"]')?.href;
    const path = location.pathname.replace(/\/$/, '') || '/';
    const robots = document.querySelector('meta[name="robots"]')?.content || '';
    // Only a known, public, canonical page can start the tag. Skip form URLs,
    // campaign values, fragments and arbitrary 404 paths entirely.
    if (started || location.search || location.hash || canonical !== location.origin + path || /noindex/i.test(robots)) return;
    started = true;
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    let referrer = '';
    if (document.referrer) {
      const url = new URL(document.referrer);
      const search = ['www.google.com', 'www.google.co.th', 'www.bing.com', 'duckduckgo.com', 'search.yahoo.com'];
      if (url.protocol === 'https:' && (url.origin === location.origin || search.includes(url.hostname))) referrer = url.origin + '/';
    }
    const page = {page_location: canonical, page_referrer: referrer, page_title: document.querySelector('meta[property="og:title"]')?.content || 'BitEvo'};
    gtag('consent', 'default', {analytics_storage:'granted', ad_storage:'denied', ad_user_data:'denied', ad_personalization:'denied'});
    gtag('js', new Date());
    gtag('set', page);
    gtag('config', measurementId, {
      ...page, send_page_view:false, allow_google_signals:false, allow_ad_personalization_signals:false,
      cookie_domain:'none', cookie_prefix:cookiePrefix, cookie_expires:maxAge, cookie_update:false
    });
    gtag('event', 'page_view', {...page, send_to:measurementId});
    const script = document.createElement('script');
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    document.head.append(script);
  }

  function save(allow) {
    withdrawn = !allow;
    try {
      localStorage.setItem(consentKey, JSON.stringify({allow, at:Date.now()}));
      if (allow) document.cookie = deniedCookie + '=; Path=/; Max-Age=0; Secure; SameSite=Lax';
    } catch {
      if (allow) {
        withdrawn = true;
        sync();
        status.textContent = ru ? 'Хранилище браузера недоступно.' : 'Browser storage is unavailable.';
        return;
      }
      // An old grant can remain readable when storage becomes read-only.
      document.cookie = deniedCookie + '=1; Path=/; Max-Age=' + maxAge + '; Secure; SameSite=Lax';
      try { localStorage.removeItem(consentKey); } catch { /* The denial cookie and read-only check take precedence. */ }
    }
    sync();
  }

  const preferences = document.createElement('details');
  preferences.dataset.gaPreferences = '';
  const summary = document.createElement('summary');
  summary.textContent = ru ? 'Настройки аналитики' : 'Analytics preferences';
  const description = document.createElement('p');
  description.textContent = ru
    ? 'Разрешить Google Analytics считать просмотры страниц с помощью аналитических cookies? '
    : 'Allow Google Analytics to count page views using analytics cookies? ';
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  const notice = document.createElement('a');
  notice.href = (ru ? '/ru/privacy' : '/privacy') + '#google-analytics';
  notice.textContent = ru ? 'Подробнее' : 'Privacy details';
  description.append(status, ' ', notice);
  const yes = document.createElement('button');
  yes.type = 'button';
  yes.textContent = ru ? 'Разрешить' : 'Allow analytics';
  const no = document.createElement('button');
  no.type = 'button';
  no.textContent = ru ? 'Отклонить / отозвать' : 'Decline / withdraw';
  yes.addEventListener('click', () => save(true));
  no.addEventListener('click', () => save(false));
  preferences.append(summary, description, yes, ' ', no);
  footer.append(preferences);
  window.addEventListener('storage', event => { if (event.key === consentKey || event.key === null) sync(); });
  window.addEventListener('pageshow', event => { if (event.persisted) sync(); });
  sync();
})();
