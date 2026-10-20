-- R50-B candidate only: separate single-use grants; NOT applied to production D1.
-- Provisioning requires an independently approved operator action. The claim
-- endpoint cannot create, reset or refund these rows. No credential is stored.
CREATE TABLE IF NOT EXISTS bitevo_r50_operator_grants (
  claim_key TEXT PRIMARY KEY NOT NULL,
  policy_digest TEXT NOT NULL CHECK(length(policy_digest) = 64),
  not_before_ms INTEGER NOT NULL CHECK(not_before_ms > 0),
  expires_at_ms INTEGER NOT NULL CHECK(expires_at_ms > not_before_ms),
  consumed_at_ms INTEGER DEFAULT NULL,
  revoked_at_ms INTEGER DEFAULT NULL,
  CHECK(length(claim_key) BETWEEN 50 AND 160),
  CHECK(consumed_at_ms IS NULL OR
    (consumed_at_ms >= not_before_ms AND consumed_at_ms < expires_at_ms)),
  CHECK(revoked_at_ms IS NULL OR revoked_at_ms >= not_before_ms)
);
