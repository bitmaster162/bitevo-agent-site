-- R50-G3-L3: local candidate only. DO NOT APPLY TO CLOUD/PRODUCTION D1.
-- Must run AFTER the unchanged bitevo_public_event_daily schema.
-- No IP, token, contact, user ID or signing material is persisted.
-- This ledger intentionally stores request IDs; privacy/retention approval remains HOLD.
CREATE TABLE IF NOT EXISTS bitevo_r50_event_request_ledger (
  request_id TEXT PRIMARY KEY NOT NULL CHECK(length(request_id) = 36),
  day TEXT NOT NULL CHECK(length(day) = 10),
  event_name TEXT NOT NULL CHECK(event_name IN ('triage_click', 'mailto_click', 'scope_generated', 'pilot_click')),
  page TEXT NOT NULL CHECK(length(page) BETWEEN 1 AND 180),
  locale TEXT NOT NULL CHECK(locale IN ('en', 'ru')),
  received_at_ms INTEGER NOT NULL CHECK(received_at_ms > 0)
);

-- A single accepted request ledger INSERT and aggregate effect are one statement.
-- If increment fails, the ledger INSERT fails and rolls back with it.
CREATE TRIGGER bitevo_r50_event_aggregate_once
AFTER INSERT ON bitevo_r50_event_request_ledger
BEGIN
  INSERT INTO bitevo_public_event_daily (day, event_name, page, locale, count)
  VALUES (NEW.day, NEW.event_name, NEW.page, NEW.locale, 1)
  ON CONFLICT(day, event_name, page, locale)
  DO UPDATE SET count = count + 1;
END;
