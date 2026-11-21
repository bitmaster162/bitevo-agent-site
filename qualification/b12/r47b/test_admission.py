"""Synthetic checks; no network, disk SQLite, provider writes or package installs.

Run with python -B -m unittest discover -s qualification/b12/r47b -v.
All IDs, timestamps and numeric limits below are fixtures, not provider settings.
"""
import ast
import copy
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import re
import sqlite3
import sys
import unittest
from unittest import mock

import admission as a

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
NOW = dt.datetime(2026, 10, 14, 2, 5, tzinfo=dt.timezone.utc)
TEMPLATE = a.parse_json((HERE / "manifest.json").read_bytes())
SIDE_EFFECT_ATTEMPTS = {"network": 0, "disk_sqlite": 0}


def forbid_effects(event, args):
    if event in ("socket.connect", "socket.bind", "socket.getaddrinfo", "socket.sendto"):
        SIDE_EFFECT_ATTEMPTS["network"] += 1
        raise RuntimeError("R47B_TEST_NETWORK_FORBIDDEN")
    if event == "sqlite3.connect" and args[0] != ":memory:":
        SIDE_EFFECT_ATTEMPTS["disk_sqlite"] += 1
        raise RuntimeError("R47B_TEST_DISK_DATABASE_FORBIDDEN")


sys.addaudithook(forbid_effects)


def complete_fixture():
    m = copy.deepcopy(TEMPLATE)
    m["production"].update(cloudflare_account_id="a" * 32,
                           d1_database_id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                           rate_limit_namespace_id="120001")
    m["isolated"] = dict(vercel_project_id="prj_R47BFixtureOnly1234", cloudflare_account_id="b" * 32,
                         worker_name="b12-isolated-fixture",
                         worker_url="https://b12-isolated-fixture.fixture.workers.dev/b1-2/event",
                         d1_database_id="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", rate_limit_namespace_id="120002")
    m["inventory"].update(evidence_kind="SYNTHETIC_FIXTURE", reference="urn:fixture:inventory",
                           sha256="1" * 64, observed_at_utc="2026-10-14T02:00:00Z",
                           valid_until_utc="2026-10-14T03:00:00Z", reviewed_by="urn:fixture:reviewer",
                           exclusive_writer_reference="urn:fixture:exclusive")
    m["plan"]["row"]["day"] = "2026-10-14"
    m["plan"]["limits"] = dict(event_posts=1, total_requests=3, response_bytes=4000,
                                duration_seconds=30, cost_minor_units=0, currency="USD")
    m["plan"]["rate_limit"] = dict(requests=1, period_seconds=60)
    m["plan"]["retention"] = dict(hours=1, owner="urn:fixture:owner",
                                   deletion_reference="urn:fixture:delete", access_reference="urn:fixture:access")
    m["plan"]["cleanup"] = dict(disable_reference="urn:fixture:disable",
                                 data_disposition_reference="urn:fixture:delete-confirm")
    return m


def trace_fixture():
    m = complete_fixture()
    row, target = m["plan"]["row"], m["isolated"]

    def obs(count, at):
        return dict(row=copy.deepcopy(row), resource=copy.deepcopy(target), count=count,
                    complete=True, reader="INDEPENDENT_SIMULATED", at=at)

    return dict(kind="SYNTHETIC_MEMORY", exclusive_writer=True,
                before=obs(0, "2026-10-14T02:00:00Z"),
                receipt=dict(outcome="CONFIRMED", status=200, ok=True, counted=True, success=True, changes=1,
                             resource=copy.deepcopy(target)),
                after=obs(1, "2026-10-14T02:00:01Z")), row, target


def replace_path(m, path, value):
    node = m
    for key in path[:-1]:
        node = node[key]
    node[path[-1]] = value


class Admission(unittest.TestCase):
    def assess(self, m):
        answer = a.evaluate_manifest(m, NOW)
        self.assertIs(answer["execution_authorized"], False)
        self.assertIs(answer["provider_identity_verified"], False)
        return answer

    def test_template_valid_but_hold(self):
        result = self.assess(TEMPLATE)
        self.assertTrue(result["schema_valid"])
        self.assertEqual(result["readiness"], "HOLD")
        self.assertIn("PRODUCTION_D1_DATABASE_ID_UNKNOWN", result["blockers"])
        self.assertIn("ISOLATED_D1_DATABASE_ID_UNKNOWN", result["blockers"])
        self.assertIn("RETENTION_HOURS_UNAPPROVED", result["blockers"])
        self.assertIn("BUDGET_EVENT_POSTS_UNKNOWN", result["blockers"])
        self.assertIsNone(TEMPLATE["plan"]["limits"]["event_posts"])

    def test_complete_fixture_still_cannot_execute(self):
        self.assertEqual(self.assess(complete_fixture())["readiness"], "DRY_RUN_COMPLETE")

    def test_canonical_uuid_not_assumed_v4(self):
        m = complete_fixture(); m["isolated"]["d1_database_id"] = "bbbbbbbb-bbbb-7bbb-8bbb-bbbbbbbbbbbb"
        self.assertEqual(self.assess(m)["readiness"], "DRY_RUN_COMPLETE")

    def test_shared_account_is_not_shared_database(self):
        m = complete_fixture()
        m["isolated"]["cloudflare_account_id"] = m["production"]["cloudflare_account_id"]
        self.assertEqual(self.assess(m)["readiness"], "DRY_RUN_COMPLETE")

    def test_root_none_rejected(self):
        self.assertEqual(self.assess(None)["readiness"], "REJECT")

    def test_currentness_naive_clock_rejected(self):
        self.assertEqual(a.evaluate_manifest(TEMPLATE, dt.datetime(2026, 10, 14))["readiness"], "REJECT")

    def test_expired_inventory_hold(self):
        m = complete_fixture(); m["inventory"]["valid_until_utc"] = "2026-10-14T02:01:00Z"
        self.assertEqual(self.assess(m)["readiness"], "HOLD")

    def test_inventory_expiry_boundary_hold(self):
        m = complete_fixture(); m["inventory"]["valid_until_utc"] = "2026-10-14T02:05:00Z"
        self.assertEqual(self.assess(m)["readiness"], "HOLD")

    def test_future_inventory_rejected(self):
        m = complete_fixture(); m["inventory"]["observed_at_utc"] = "2026-10-14T02:06:00Z"
        self.assertEqual(self.assess(m)["readiness"], "REJECT")

    def test_inverted_inventory_window_rejected(self):
        m = complete_fixture(); m["inventory"]["valid_until_utc"] = "2026-10-14T01:59:00Z"
        self.assertEqual(self.assess(m)["readiness"], "REJECT")

    def test_embedded_secret_field_not_echoed(self):
        m = complete_fixture(); m["plan"]["signing_secret"] = "DO_NOT_ECHO_FIXTURE_SECRET"
        result = self.assess(m)
        self.assertEqual(result["readiness"], "REJECT")
        self.assertNotIn("DO_NOT_ECHO", json.dumps(result))

    def test_reference_claim_not_provider_verification(self):
        m = complete_fixture(); m["inventory"]["evidence_kind"] = "REFERENCE_ONLY"
        result = self.assess(m)
        self.assertEqual(result["readiness"], "DRY_RUN_COMPLETE")
        self.assertFalse(result["provider_identity_verified"])

    def test_malformed_rows_fail_closed(self):
        for val in [None, [], True, {"foo": "bar"}]:
            m = complete_fixture(); m["plan"]["row"] = val
            self.assertEqual(self.assess(m)["readiness"], "REJECT")


REJECT_MUTATIONS = [
    ("schema", ["schema"], "future-v99"),
    ("mode", ["mode"], "LIVE"),
    ("repo", ["source", "repository"], "someone/else"),
    ("commit", ["source", "commit"], "0" * 40),
    ("tree", ["source", "tree"], "1" * 40),
    ("authority", ["authority", "scope"], "CLOUD_WRITE"),
    ("authorization_bool", ["authority", "provider_execution"], True),
    ("authorization_int", ["authority", "provider_execution"], 0),
    ("approval_ref", ["authority", "cloud_approval_reference"], "urn:owner:approved"),
    ("fake_verified_evidence", ["inventory", "evidence_kind"], "VERIFIED"),
    ("bad_sha", ["inventory", "sha256"], "not-a-hash"),
    ("naive_evidence_time", ["inventory", "observed_at_utc"], "2026-10-14T02:00:00"),
    ("bad_evidence_day", ["inventory", "observed_at_utc"], "2026-02-30T02:00:00Z"),
    ("url_credentials", ["isolated", "worker_url"], "https://x:y@b12-isolated-fixture.fixture.workers.dev/b1-2/event"),
    ("url_http", ["isolated", "worker_url"], "http://b12-isolated-fixture.fixture.workers.dev/b1-2/event"),
    ("url_query", ["isolated", "worker_url"], "https://b12-isolated-fixture.fixture.workers.dev/b1-2/event?secret=bad"),
    ("url_fragment", ["isolated", "worker_url"], "https://b12-isolated-fixture.fixture.workers.dev/b1-2/event#x"),
    ("url_port", ["isolated", "worker_url"], "https://b12-isolated-fixture.fixture.workers.dev:443/b1-2/event"),
    ("url_newline", ["isolated", "worker_url"], "https://b12-isolated-fixture.fixture.workers.dev/\nb1-2/event"),
    ("url_localhost", ["isolated", "worker_url"], "https://127.0.0.1/b1-2/event"),
    ("url_suffix_trick", ["isolated", "worker_url"], "https://b12-isolated-fixture.workers.dev.evil.invalid/b1-2/event"),
    ("url_encoded_path", ["isolated", "worker_url"], "https://b12-isolated-fixture.fixture.workers.dev/b1-2/%65vent"),
    ("namespace_noncanonical", ["isolated", "rate_limit_namespace_id"], "0120001"),
    ("unknown_db_placeholder", ["isolated", "d1_database_id"], "TODO"),
    ("new_prod_anchor", ["production", "vercel_project_id"], "prj_OtherProd12345"),
    ("preview_bypass", ["plan", "path"], "SPOOF_VERCEL_PRODUCTION_ENV"),
    ("nonsynthetic", ["plan", "synthetic_data_only"], False),
    ("delta_bool", ["plan", "desired_positive_delta"], True),
    ("negative_delta", ["plan", "desired_negative_delta"], 1),
    ("retry", ["plan", "outcome_unknown"], "RETRY"),
    ("bad_row_day", ["plan", "row", "day"], "2026-02-30"),
    ("event_type", ["plan", "row", "event_name"], "purchase"),
    ("path_query", ["plan", "row", "page"], "/agent-authority-audit?email=bad"),
    ("path_traversal", ["plan", "row", "page"], "/../private"),
    ("locale_mismatch", ["plan", "row", "locale"], "ru"),
    ("too_many_posts", ["plan", "limits", "event_posts"], 2),
    ("insufficient_gets", ["plan", "limits", "total_requests"], 2),
    ("currency", ["plan", "limits", "currency"], "usd"),
    ("retention_zero", ["plan", "retention", "hours"], 0),
    ("retention_guarantee", ["plan", "retention", "hours"], True),
    ("delete_ref_secret_url", ["plan", "retention", "deletion_reference"], "https://secret:token@example.invalid")
]
for key, value in a.CONTROLS.items():
    REJECT_MUTATIONS.append(("guard_" + key, ["controls", key], True if value is False else "BYPASS"))
for key in ("event_posts", "total_requests", "response_bytes", "duration_seconds", "cost_minor_units"):
    for name, value in [("bool", True), ("negative", -1), ("float", 1.5), ("huge", 2**53)]:
        REJECT_MUTATIONS.append(("budget_" + key + "_" + name, ["plan", "limits", key], value))
for group in ("production", "isolated"):
    for key in a.IDS:
        if group == "production" and a.KNOWN_PRODUCTION[key] is not None:
            continue

        def unknown(self, group=group, key=key):
            m = complete_fixture(); m[group][key] = None
            self.assertEqual(self.assess(m)["readiness"], "HOLD")

        setattr(Admission, "test_unknown_" + group + "_" + key, unknown)
for name, path, value in REJECT_MUTATIONS:
    def mutation(self, path=path, value=value):
        m = complete_fixture(); replace_path(m, path, value)
        self.assertEqual(self.assess(m)["readiness"], "REJECT", path)

    setattr(Admission, "test_reject_" + name, mutation)
for key in a.IDS - {"cloudflare_account_id"}:
    def collision(self, key=key):
        m = complete_fixture(); m["isolated"][key] = m["production"][key]
        self.assertEqual(self.assess(m)["readiness"], "REJECT")

    setattr(Admission, "test_production_collision_" + key, collision)


class Parser(unittest.TestCase):
    def test_duplicate_key(self):
        with self.assertRaisesRegex(a.Rejected, "DUPLICATE"):
            a.parse_json(b'{"x":1,"x":2}')

    def test_nested_duplicate(self):
        with self.assertRaisesRegex(a.Rejected, "DUPLICATE"):
            a.parse_json(b'{"x":{"a":1,"a":2}}')

    def test_nonfinite(self):
        for text in [b'{"x":NaN}', b'{"x":Infinity}', b'{"x":-Infinity}']:
            with self.assertRaises(a.Rejected):
                a.parse_json(text)

    def test_size_cap(self):
        with self.assertRaises(a.Rejected):
            a.parse_json(b" " * (a.MAX_INPUT_BYTES + 1))

    def test_wrong_root(self):
        for text in [b'[]', b'true', b'null', b'123']:
            with self.assertRaises(a.Rejected):
                a.parse_json(text)

    def test_invalid_utf8(self):
        with self.assertRaises(a.Rejected):
            a.parse_json(b'\xff')

    def test_roundtrip(self):
        self.assertEqual(a.parse_json(json.dumps(TEMPLATE).encode()), TEMPLATE)


    def test_exponent_overflow_rejected(self):
        for exponent in ('1e309', '-1e309', '1e999', '-1e999',
                         '1.7976931348623159e308', '-1.7976931348623159e308', '9E999', '-9E999'):
            with self.subTest(exponent=exponent):
                with self.assertRaisesRegex(a.Rejected, 'NON_FINITE_JSON'):
                    a.parse_json(b'{"x":' + exponent.encode('ascii') + b'}')

    def test_nested_exponent_overflow_rejected(self):
        for payload in (b'{"x":[1e999]}', b'{"x":{"y":-1e999}}', b'{"x":[{"y":9E999}]}'):
            with self.subTest(payload=payload):
                with self.assertRaisesRegex(a.Rejected, 'NON_FINITE_JSON'):
                    a.parse_json(payload)

    def test_finite_exponents_remain_valid(self):
        for exponent in ('0e999', '1e308', '-1e308', '1.7976931348623157e308', '1e-999', '-0.0'):
            with self.subTest(exponent=exponent):
                out = a.parse_json(b'{"x":' + exponent.encode('ascii') + b'}')
                self.assertTrue(math.isfinite(out['x']))
                self.assertEqual(out['x'], float(exponent))
        self.assertEqual(a.parse_json(b'{"x":"1e999"}'), {'x': '1e999'})


class Evidence(unittest.TestCase):
    def check(self, trace, row, target):
        out = a.evaluate_trace(trace, row, target)
        self.assertFalse(out["real_provider_proven"])
        self.assertFalse(out["retry_allowed"])
        self.assertFalse(out["execution_authorized"])
        self.assertFalse(out["exactly_once_proven"])
        return out

    def test_positive_delta_one(self):
        t, r, p = trace_fixture()
        self.assertEqual(self.check(t, r, p)["simulation_result"], "PASS")

    def test_no_target_never_qualifies(self):
        t, r, p = trace_fixture()
        self.assertEqual(a.evaluate_trace(t, r)["simulation_result"], "REJECT")

    def test_200_without_delta_rejected(self):
        t, r, p = trace_fixture(); t["after"]["count"] = 0
        self.assertEqual(self.check(t, r, p)["simulation_result"], "REJECT")

    def test_repeated_write_delta_two_rejected(self):
        t, r, p = trace_fixture(); t["after"]["count"] = 2
        self.assertEqual(self.check(t, r, p)["simulation_result"], "REJECT")

    def test_unknown_after_increment_is_not_retry_permission(self):
        t, r, p = trace_fixture(); t["receipt"]["outcome"] = "UNKNOWN"
        self.assertEqual(self.check(t, r, p)["simulation_result"], "HOLD")

    def test_unknown_without_increment_still_hold(self):
        t, r, p = trace_fixture(); t["receipt"]["outcome"] = "UNKNOWN"; t["after"]["count"] = 0
        self.assertEqual(self.check(t, r, p)["simulation_result"], "HOLD")

    def test_no_baseline_not_assumed_zero(self):
        t, r, p = trace_fixture(); t["before"]["count"] = None
        self.assertEqual(self.check(t, r, p)["simulation_result"], "REJECT")

    def test_incomplete_report_not_assumed_zero(self):
        t, r, p = trace_fixture(); t["before"]["complete"] = False
        self.assertEqual(self.check(t, r, p)["simulation_result"], "REJECT")

    def test_own_receipt_is_not_independent_reader(self):
        t, r, p = trace_fixture(); t["after"]["reader"] = "WRITER"
        self.assertEqual(self.check(t, r, p)["simulation_result"], "REJECT")

    def test_stale_after_read_rejected(self):
        t, r, p = trace_fixture(); t["after"]["at"] = t["before"]["at"]
        self.assertEqual(self.check(t, r, p)["simulation_result"], "REJECT")

    def test_wrong_row_rejected(self):
        t, r, p = trace_fixture(); t["after"]["row"]["event_name"] = "pilot_click"
        self.assertEqual(self.check(t, r, p)["simulation_result"], "REJECT")

    def test_wrong_database_readback_rejected(self):
        t, r, p = trace_fixture(); t["after"]["resource"]["d1_database_id"] = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
        self.assertEqual(self.check(t, r, p)["simulation_result"], "REJECT")

    def test_wrong_database_receipt_rejected(self):
        t, r, p = trace_fixture(); t["receipt"]["resource"]["d1_database_id"] = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
        self.assertEqual(self.check(t, r, p)["simulation_result"], "REJECT")

    def test_concurrent_writer_not_proven(self):
        t, r, p = trace_fixture(); t["exclusive_writer"] = False
        self.assertEqual(self.check(t, r, p)["simulation_result"], "REJECT")

    def test_real_label_rejected(self):
        t, r, p = trace_fixture(); t["kind"] = "REAL_PROVIDER"
        self.assertEqual(self.check(t, r, p)["simulation_result"], "REJECT")

    def test_changes_bool_rejected(self):
        t, r, p = trace_fixture(); t["receipt"]["changes"] = True
        self.assertEqual(self.check(t, r, p)["simulation_result"], "REJECT")

    def test_count_bool_rejected(self):
        t, r, p = trace_fixture(); t["after"]["count"] = True
        self.assertEqual(self.check(t, r, p)["simulation_result"], "REJECT")

    def test_unknown_http503_not_safe_rejection(self):
        t, r, p = trace_fixture(); t["after"]["count"] = 0
        t["receipt"].update(outcome="REJECTED", status=503, ok=False, counted=False, success=False, changes=0)
        self.assertEqual(self.check(t, r, p)["simulation_result"], "REJECT")


    def _f1_trace_target(self, outcome='CONFIRMED', change_name=False, valid_pair=False):
        trace, row, target = trace_fixture()
        if change_name:
            target['worker_name'] = 'different-isolated-fixture'
        else:
            target['worker_url'] = 'https://different-isolated-fixture.fixture.workers.dev/b1-2/event'
        if valid_pair:
            target['worker_name'] = 'different-isolated-fixture'
        for part in ('before', 'receipt', 'after'):
            trace[part]['resource'] = copy.deepcopy(target)
        if outcome == 'REJECTED':
            trace['after']['count'] = 0
            trace['receipt'].update(outcome='REJECTED', status=403, ok=False,
                                    counted=False, success=False, changes=0)
        elif outcome == 'UNKNOWN':
            trace['receipt']['outcome'] = 'UNKNOWN'
        return trace, row, target

    def test_worker_url_mismatch_confirmed_rejected(self):
        trace, row, target = self._f1_trace_target()
        out = self.check(trace, row, target)
        self.assertEqual(out['simulation_result'], 'REJECT')
        self.assertEqual(out['reason'], 'WORKER_NAME_URL_MISMATCH')
        manifest = complete_fixture()
        manifest['isolated'] = target
        self.assertIn('WORKER_NAME_URL_MISMATCH', a.evaluate_manifest(manifest, NOW)['errors'])

    def test_worker_url_mismatch_negative_rejected(self):
        out = self.check(*self._f1_trace_target(outcome='REJECTED'))
        self.assertEqual(out['simulation_result'], 'REJECT')
        self.assertEqual(out['reason'], 'WORKER_NAME_URL_MISMATCH')

    def test_worker_url_mismatch_unknown_rejected(self):
        out = self.check(*self._f1_trace_target(outcome='UNKNOWN'))
        self.assertEqual(out['simulation_result'], 'REJECT')
        self.assertEqual(out['reason'], 'WORKER_NAME_URL_MISMATCH')

    def test_worker_name_mismatch_rejected(self):
        out = self.check(*self._f1_trace_target(change_name=True))
        self.assertEqual(out['simulation_result'], 'REJECT')
        self.assertEqual(out['reason'], 'WORKER_NAME_URL_MISMATCH')

    def test_matching_renamed_target_positive(self):
        out = self.check(*self._f1_trace_target(valid_pair=True))
        self.assertEqual(out['simulation_result'], 'PASS')
        self.assertEqual(out['delta'], 1)

    def test_matching_renamed_target_negative(self):
        out = self.check(*self._f1_trace_target(outcome='REJECTED', valid_pair=True))
        self.assertEqual(out['simulation_result'], 'PASS')
        self.assertEqual(out['delta'], 0)


for status in (400, 401, 403, 404, 405, 413, 415, 429):
    def negative(self, status=status):
        t, r, p = trace_fixture(); t["after"]["count"] = 0
        t["receipt"].update(outcome="REJECTED", status=status, ok=False, counted=False, success=False, changes=0)
        self.assertEqual(self.check(t, r, p)["simulation_result"], "PASS")
        t["after"]["count"] = 1
        self.assertEqual(self.check(t, r, p)["simulation_result"], "REJECT")

    setattr(Evidence, "test_negative_status_" + str(status), negative)


class Budget(unittest.TestCase):
    def values(self):
        limits = complete_fixture()["plan"]["limits"].copy(); limits.pop("currency")
        return limits, {k: 0 for k in limits}

    def test_one_proposed_attempt_within_budget(self):
        limits, zero = self.values(); proposed = dict(zero, event_posts=1, total_requests=1)
        out = a.evaluate_budget(limits, zero, proposed)
        self.assertTrue(out["within_declared_budget"])
        self.assertFalse(out["execution_authorized"])

    def test_retry_second_post_denied(self):
        limits, zero = self.values(); used = dict(zero, event_posts=1, total_requests=1)
        self.assertFalse(a.evaluate_budget(limits, used, used)["within_declared_budget"])

    def test_used_over_budget_denied(self):
        limits, zero = self.values()
        self.assertFalse(a.evaluate_budget(limits, dict(zero, total_requests=4), zero)["within_declared_budget"])

    def test_unknown_budget_denied(self):
        limits, zero = self.values(); limits["duration_seconds"] = None
        self.assertFalse(a.evaluate_budget(limits, zero, zero)["within_declared_budget"])

    def test_cost_zero_allows_no_positive_cost(self):
        limits, zero = self.values()
        self.assertFalse(a.evaluate_budget(limits, zero, dict(zero, cost_minor_units=1))["within_declared_budget"])

    def test_post_must_count_as_request(self):
        limits, zero = self.values()
        self.assertFalse(a.evaluate_budget(limits, zero, dict(zero, event_posts=1))["within_declared_budget"])


for field in ("event_posts", "total_requests", "response_bytes", "duration_seconds", "cost_minor_units"):
    def exhausted(self, field=field):
        lim, zero = self.values()
        used = dict(zero); used[field] = lim[field]
        proposed = dict(zero); proposed[field] = 1
        if field == "event_posts":
            used["total_requests"] = used["event_posts"]
            proposed["total_requests"] = proposed["event_posts"]
        answer = a.evaluate_budget(lim, used, proposed)
        self.assertFalse(answer["within_declared_budget"])
        self.assertEqual(answer["reason"], "BUDGET_EXHAUSTED")

    setattr(Budget, "test_exhausted_" + field, exhausted)


class MemorySQL(unittest.TestCase):
    def test_real_schema_upsert_and_no_exactly_once_claim(self):
        sql = (ROOT / "schema/bitevo_public_event_daily.sql").read_text(encoding="utf-8")
        source = (ROOT / "worker/index.mjs").read_text(encoding="utf-8")
        body = re.search(r"const UPSERT = (\[[\s\S]*?\])\.join\(' '\)", source).group(1)
        statement = " ".join(ast.literal_eval(body))
        for path, text in [("schema/bitevo_public_event_daily.sql", sql), ("worker/index.mjs", source)]:
            self.assertEqual(hashlib.sha256(text.encode()).hexdigest(), a.PROTECTED_SHA256[path])
        db = sqlite3.connect(":memory:")
        db.set_authorizer(lambda op, *args: sqlite3.SQLITE_DENY if op in (sqlite3.SQLITE_ATTACH, sqlite3.SQLITE_DETACH) else sqlite3.SQLITE_OK)
        try:
            with self.assertRaises(sqlite3.DatabaseError):
                db.execute("ATTACH DATABASE ':memory:' AS forbidden")
            db.executescript(sql)
            columns = [x[1] for x in db.execute("PRAGMA table_info(bitevo_public_event_daily)")]
            self.assertEqual(columns, ["day", "event_name", "page", "locale", "count"])
            key = ("2026-10-14", "triage_click", "/agent-authority-audit", "en")
            query = "SELECT count FROM bitevo_public_event_daily WHERE day=? AND event_name=? AND page=? AND locale=?"
            self.assertIsNone(db.execute(query, key).fetchone())
            db.execute(statement, key)
            self.assertEqual(db.execute(query, key).fetchone()[0], 1)
            db.execute(statement, key)
            self.assertEqual(db.execute(query, key).fetchone()[0], 2)
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute(statement, ("2026-10-14", "purchase", "/agent-authority-audit", "en"))
            self.assertEqual(db.execute(query, key).fetchone()[0], 2)
        finally:
            db.close()


class Source(unittest.TestCase):
    def test_actual_protected_source_and_git_identity(self):
        result = a.check_source(ROOT)
        self.assertTrue(result["protected_content_match"])
        self.assertEqual(result["files_checked"], 13)

    def test_changed_source_rejected(self):
        with mock.patch.dict(a.PROTECTED_SHA256, {"api/event.ts": "0" * 64}):
            result = a.check_source(ROOT)
        self.assertFalse(result["protected_content_match"])
        self.assertIn("api/event.ts", result["failed_paths"])

    def test_git_head_drift_rejected(self):
        fake = mock.Mock(returncode=0, stdout=("0" * 40 + "\n").encode())
        with mock.patch.object(a.subprocess, "run", return_value=fake):
            with self.assertRaisesRegex(a.Rejected, "BASELINE_DRIFT"):
                a.check_source(ROOT)

    def test_effect_attempt_counters_remain_zero(self):
        self.assertEqual(SIDE_EFFECT_ATTEMPTS, {"network": 0, "disk_sqlite": 0})

    def test_matrix_test_names_resolve(self):
        table = json.loads((HERE / "expected-observed.json").read_text(encoding="utf8"))
        for row in table["cases"]:
            cls, name = row["test"].split(".")
            self.assertTrue(callable(getattr(globals()[cls], name, None)))

    def test_expected_observed_is_specification_not_live_evidence(self):
        table = json.loads((HERE / "expected-observed.json").read_text(encoding="utf8"))
        self.assertEqual(table["scope"], "OFFLINE_SYNTHETIC_EXPECTATIONS")
        for row in table["cases"]:
            self.assertIsNone(row["provider_observed"])
        self.assertFalse(table["live_results_claimed"])


class Persistence(unittest.TestCase):
    """Memory-only commit transcripts; no commit, index or object-store writes."""
    @classmethod
    def setUpClass(cls):
        cls.base_commit = a.local_git(ROOT, "cat-file", "commit", a.BASE)
        cls.base_listing = a.local_git(ROOT, "ls-tree", "-r", "-z", "--full-tree", a.TREE)
        cls.base_entries = a.tree_entries(cls.base_listing)
        cls.package = {p: (ROOT / p).read_bytes().replace(b"\r\n", b"\n") for p in a.PACKAGE_PATHS}

    @staticmethod
    def listing(entries):
        return b"".join((mode + " " + kind + " " + oid + "\t" + path).encode() + b"\0"
                        for path, (mode, kind, oid) in sorted(entries.items()))

    def entries(self):
        result = dict(self.base_entries)
        result.update({p: ("100644", "blob", a.object_id(b"blob", data)) for p, data in self.package.items()})
        return result

    def snapshot(self, entries=None, parents=None, status=b"", package=None):
        entries = self.entries() if entries is None else entries
        parents = [a.BASE] if parents is None else parents
        tree = a.tree_identity(entries)
        commit = ("tree " + tree + "\n" + "".join("parent " + p + "\n" for p in parents)
                  + "author Fixture <fixture@invalid> 1700000000 +0000\n"
                  + "committer Fixture <fixture@invalid> 1700000000 +0000\n\n"
                  + "R47B synthetic object; not written or authorized\n").encode()
        return dict(base_commit=self.base_commit, base_listing=self.base_listing,
                    head=a.object_id(b"commit", commit), head_commit=commit,
                    head_listing=self.listing(entries), status=status,
                    package=self.package if package is None else package)

    def rejected(self, snapshot, reason):
        with self.assertRaisesRegex(a.Rejected, reason):
            a.evaluate_source_lineage(**snapshot)

    def test_baseline_tree_reconstruction(self):
        self.assertEqual(a.tree_identity(self.base_entries), a.TREE)
        self.assertEqual(len(self.base_entries), 407)

    def test_one_direct_package_commit_is_scope_admitted_only(self):
        result = a.evaluate_source_lineage(**self.snapshot())
        self.assertEqual(result['lineage_mode'], 'ONE_DIRECT_PACKAGE_COMMIT')
        self.assertEqual(result['baseline_entries_checked'], 407)
        self.assertEqual(result['package_files'], 5)
        self.assertIs(result['execution_authorized'], False)
        self.assertIs(result['candidate_review_required'], True)

    def test_full_source_wrapper_accepts_exact_simulated_child(self):
        snap = self.snapshot()
        tree, _ = a.commit_identity(snap['head_commit'], snap['head'])
        table = {('rev-parse', '--verify', 'HEAD'): (snap['head'] + '\n').encode(),
                 ('cat-file', 'commit', a.BASE): self.base_commit,
                 ('cat-file', 'commit', snap['head']): snap['head_commit'],
                 ('ls-tree', '-r', '-z', '--full-tree', a.TREE): self.base_listing,
                 ('ls-tree', '-r', '-z', '--full-tree', tree): snap['head_listing'],
                 ('status', '--porcelain=v1', '-z', '--untracked-files=all'): b''}
        with mock.patch.object(a, 'local_git', side_effect=lambda root, *args: table[args]):
            result = a.check_source(ROOT)
        self.assertTrue(result['protected_content_match'])
        self.assertEqual(result['lineage_mode'], 'ONE_DIRECT_PACKAGE_COMMIT')
        self.assertFalse(result['execution_authorized'])

    def test_wrong_parent_rejected(self):
        self.rejected(self.snapshot(parents=['1' * 40]), 'NOT_ONE_DIRECT')

    def test_merge_commit_rejected(self):
        self.rejected(self.snapshot(parents=[a.BASE, '1' * 40]), 'NOT_ONE_DIRECT')

    def test_duplicate_parent_rejected(self):
        self.rejected(self.snapshot(parents=[a.BASE, a.BASE]), 'NOT_ONE_DIRECT')

    def test_parentless_commit_rejected(self):
        self.rejected(self.snapshot(parents=[]), 'NOT_ONE_DIRECT')

    def test_second_package_commit_requires_new_policy(self):
        first = self.snapshot()['head']
        self.rejected(self.snapshot(parents=[first]), 'NOT_ONE_DIRECT')

    def test_baseline_file_edit_outside_13_pins_rejected(self):
        entries = self.entries()
        self.assertNotIn('README.md', a.PROTECTED_SHA256)
        entries['README.md'] = ('100644', 'blob', a.object_id(b'blob', b'changed\n'))
        self.rejected(self.snapshot(entries), 'BASELINE_CONTENT_CHANGED')

    def test_baseline_file_deleted_rejected(self):
        entries = self.entries(); del entries['README.md']
        self.rejected(self.snapshot(entries), 'COMMITTED_SCOPE')

    def test_baseline_file_mode_changed_rejected(self):
        entries = self.entries(); _, kind, oid = entries['README.md']
        entries['README.md'] = ('100755', kind, oid)
        self.rejected(self.snapshot(entries), 'BASELINE_CONTENT_CHANGED')

    def test_extra_file_outside_package_rejected(self):
        entries = self.entries(); entries['unexpected.txt'] = ('100644', 'blob', '1' * 40)
        self.rejected(self.snapshot(entries), 'COMMITTED_SCOPE')

    def test_sixth_file_in_package_rejected(self):
        entries = self.entries(); entries['qualification/b12/r47b/extra.py'] = ('100644', 'blob', '1' * 40)
        self.rejected(self.snapshot(entries), 'COMMITTED_SCOPE')

    def test_missing_each_package_file_rejected(self):
        for path in a.PACKAGE_PATHS:
            with self.subTest(path=path):
                entries = self.entries(); del entries[path]
                self.rejected(self.snapshot(entries), 'COMMITTED_SCOPE')

    def test_added_executable_symlink_and_submodule_rejected(self):
        path = 'qualification/b12/r47b/admission.py'
        for mode, kind in [('100755', 'blob'), ('120000', 'blob'), ('160000', 'commit')]:
            with self.subTest(mode=mode):
                entries = self.entries(); entries[path] = (mode, kind, entries[path][2])
                self.rejected(self.snapshot(entries), 'PACKAGE_BLOB_MISMATCH')

    def test_package_worktree_blob_mismatch_rejected(self):
        package = dict(self.package)
        package['qualification/b12/r47b/README.md'] += b'not committed\n'
        self.rejected(self.snapshot(package=package), 'PACKAGE_BLOB_MISMATCH')

    def test_staged_unstaged_untracked_after_commit_rejected(self):
        for marker in (b'M  ', b' M ', b'?? '):
            with self.subTest(marker=marker):
                self.rejected(self.snapshot(status=marker + b'qualification/b12/r47b/README.md\0'), 'WORKTREE_DIRTY')

    def test_commit_object_tampering_rejected(self):
        snap = self.snapshot(); snap['head_commit'] += b'tampered'
        self.rejected(snap, 'COMMIT_OBJECT_MISMATCH')

    def test_baseline_object_tampering_rejected(self):
        snap = self.snapshot(); snap['base_commit'] += b'tampered'
        self.rejected(snap, 'COMMIT_OBJECT_MISMATCH')

    def test_tree_listing_object_mismatch_rejected(self):
        snap = self.snapshot(); snap['head_listing'] = self.base_listing
        self.rejected(snap, 'CANDIDATE_TREE_MISMATCH')

    def test_baseline_listing_object_mismatch_rejected(self):
        snap = self.snapshot(); snap['base_listing'] = self.listing(self.entries())
        self.rejected(snap, 'BASELINE_TREE_MISMATCH')

    def test_precommit_and_staged_all_five_are_not_execution(self):
        for code in ('?? ', 'A  '):
            with self.subTest(code=code):
                snap = self.snapshot()
                snap.update(head=a.BASE, head_commit=self.base_commit, head_listing=self.base_listing,
                            status=b''.join((code + p).encode() + b'\0' for p in sorted(a.PACKAGE_PATHS)))
                out = a.evaluate_source_lineage(**snap)
                self.assertEqual(out['lineage_mode'], 'BASELINE_PRECOMMIT')
                self.assertFalse(out['execution_authorized'])

    def test_precommit_dirty_baseline_rejected(self):
        snap = self.snapshot()
        snap.update(head=a.BASE, head_commit=self.base_commit, head_listing=self.base_listing,
                    status=b' M README.md\0')
        self.rejected(snap, 'LOCAL_PACKAGE_SCOPE')

    def test_precommit_mixed_staging_rejected(self):
        paths = sorted(a.PACKAGE_PATHS)
        snap = self.snapshot()
        snap.update(head=a.BASE, head_commit=self.base_commit, head_listing=self.base_listing,
                    status=b''.join((('A  ' if i == 0 else '?? ') + p).encode() + b'\0' for i,p in enumerate(paths)))
        self.rejected(snap, 'LOCAL_PACKAGE_SCOPE')

    def test_precommit_duplicate_status_path_rejected(self):
        path = sorted(a.PACKAGE_PATHS)[0]
        snap = self.snapshot()
        snap.update(head=a.BASE, head_commit=self.base_commit, head_listing=self.base_listing,
                    status=(('?? ' + path).encode() + b'\0') * 5)
        self.rejected(snap, 'LOCAL_PACKAGE_SCOPE')

    def test_tree_duplicate_or_case_collision_rejected(self):
        line = b'100644 blob ' + b'1' * 40 + b'\tREADME.md\0'
        for extra in (line, line.replace(b'README.md', b'readme.md')):
            with self.subTest(extra=extra):
                with self.assertRaisesRegex(a.Rejected, 'TREE_DUPLICATE'):
                    a.tree_entries(line + extra)

    def test_tree_path_escape_rejected(self):
        for path in ('../x', '/x', 'a//x', 'a/./x', 'a/.git/x', 'a\\x', 'a:x'):
            with self.subTest(path=path):
                with self.assertRaisesRegex(a.Rejected, 'TREE_PATH'):
                    a.tree_entries(('100644 blob ' + '1' * 40 + '\t' + path).encode() + b'\0')

    def test_tree_file_directory_collision_rejected(self):
        with self.assertRaisesRegex(a.Rejected, 'PATH_COLLISION'):
            a.tree_identity({'x': ('100644', 'blob', '1' * 40), 'x/y': ('100644', 'blob', '2' * 40)})

    def test_oversized_empty_and_control_bytes_package_rejected(self):
        path = sorted(a.PACKAGE_PATHS)[0]
        for body in (b'', b'x' * (a.MAX_INPUT_BYTES + 1), b'x\0y', b'x\ry'):
            with self.subTest(size=len(body)):
                package = dict(self.package); package[path] = body
                self.rejected(self.snapshot(package=package), 'PACKAGE_CONTENT')

    def test_git_head_changes_during_read_rejected(self):
        real = a.local_git; count = 0
        def changing(root, *args):
            nonlocal count
            if args == ('rev-parse', '--verify', 'HEAD'):
                count += 1
                if count == 2: return b'1' * 40 + b'\n'
            return real(root, *args)
        with mock.patch.object(a, 'local_git', side_effect=changing):
            with self.assertRaisesRegex(a.Rejected, 'HEAD_CHANGED_DURING_READ'):
                a.check_source(ROOT)

    def test_native_calls_disable_replace_and_optional_writes(self):
        real = a.subprocess.run
        with mock.patch.object(a.subprocess, 'run', wraps=real) as spy:
            a.check_source(ROOT)
        self.assertGreaterEqual(spy.call_count, 5)
        for call in spy.call_args_list:
            command = call.args[0]
            self.assertIn('--no-replace-objects', command)
            self.assertIn('--no-optional-locks', command)
            self.assertEqual(call.kwargs['env']['GIT_NO_LAZY_FETCH'], '1')
            self.assertEqual(call.kwargs['env']['GIT_OPTIONAL_LOCKS'], '0')
            operation = command[command.index(str(ROOT)) + 1]
            self.assertIn(operation, ('rev-parse', 'cat-file', 'ls-tree', 'status'))
            self.assertNotIn('-w', command)

    def test_git_hash_object_crosscheck_without_object_writes(self):
        snap = self.snapshot()
        raw = snap['head_commit']
        command = ['git', '--no-optional-locks', '--no-replace-objects', '-C', str(ROOT),
                   'hash-object', '-t', 'commit', '--stdin']
        answer = a.subprocess.run(command, input=raw, capture_output=True, timeout=10, check=False)
        self.assertEqual(answer.returncode, 0)
        self.assertEqual(answer.stdout.decode().strip(), snap['head'])
        self.assertNotIn('-w', command)


if __name__ == "__main__":
    unittest.main(verbosity=2)
