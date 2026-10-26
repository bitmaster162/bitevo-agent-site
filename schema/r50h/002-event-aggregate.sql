-- B1.2 local-only schema. No production D1 database or binding is provisioned.
-- Only daily aggregate counters; never store IP, HMAC tokens, request IDs,
-- cookies, names, contacts, generated briefs or form content.
CREATE TABLE IF NOT EXISTS bitevo_public_event_daily (
  day TEXT NOT NULL CHECK (
    length(day) = 10 AND
    day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
  ),
  event_name TEXT NOT NULL CHECK (
    event_name IN ('triage_click', 'mailto_click', 'scope_generated', 'pilot_click')
  ),
  page TEXT NOT NULL CHECK (
    length(page) BETWEEN 1 AND 180
    AND substr(page, 1, 1) = '/'
    AND substr(page, 1, 2) != '//'
    AND instr(page, '?') = 0
    AND instr(page, '#') = 0
  ),
  locale TEXT NOT NULL CHECK (locale IN ('ru', 'en')),
  count INTEGER NOT NULL CHECK (count >= 1),
  PRIMARY KEY (day, event_name, page, locale)
);
