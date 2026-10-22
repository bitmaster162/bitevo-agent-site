"""R47B offline admission and evidence evaluator. Never executes provider operations.

This version has no live execution path and cannot issue permission.
Inventory references remain unverified declarations, even in complete fixtures.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
from typing import Any
from urllib.parse import urlsplit
import uuid

SCHEMA = "bitevo.b12.isolated-qualification.v1"
BASE = "622d4580c8953688e26cb4ab9fc67825087b8428"
TREE = "bf97d795936e31cb03ed5f60fcb9d5a06b04e1e3"
REPOSITORY = "bitmaster162/bitevo-agent-site"
MAX_INPUT_BYTES = 65536  # Local parser budget, not a provider or global rate limit.
SAFE_INTEGER = 2**53 - 1
PROTECTED_SHA256 = {
    "api/event.ts": "383249ccccc1d50291b47b0784299a166b5ec71aa4ed34c5dd614525127e9a3e",
    "package-lock.json": "ac271324d12cc0504e6685e08ac8bc3f75ff82cdb4900078f2e25d0dea45d3b1",
    "package.json": "9f52c6fae95c8a75333735b90290364b1b4d7ae43b7e4481d6b36cbb82a25c7f",
    "public/bitevo-event-counter.js": "f9940a3c44169fbdc3bf8bee61997341bc45021831973721aabe545fba9c6a65",
    "schema/bitevo_public_event_daily.sql": "f5f5e624d661108018bc65dcc9acf9e48afd4454ad14849af01b97df6495f581",
    "src/data/bitevo-event-coverage.json": "ec39740e1fc0a62f392ab5106e27a9e91c34144604aa557bdc152f73eb5a000d",
    "src/layouts/Layout.astro": "b8adee5a71826d31f02aeac33b12b94884f3059206a880296eecfa72255b3e29",
    "src/pages/privacy.astro": "74da034a3f0688295fb82978415d2f1f83c7b9c2accf50ae9af759988a42e3f6",
    "src/pages/ru/privacy.astro": "b48cf1a34dc5488fc2a2956142fde6f560a117ecf71986898a0d276ae8a7a439",
    "tsconfig.api.json": "85aac9b41ad1432c35d677e6cddef5436f38ffb061de7e8d84f68d98b757b0b2",
    "vercel.json": "c48845f7aa6c49501e28b77d029da96ccfdaccf793d03b5f83a3c73d2838849e",
    "worker/index.mjs": "79f7d73f85075ff39fb8213c993bd5b0cb553cd9d82b095e362b7800b1af9eeb",
    "wrangler.jsonc": "59fd9a7d3fd47d8e648e649b96ab39faa1e1159a8a8302413e38652eda5f7974"
}
KNOWN_PRODUCTION = {
    "vercel_project_id": "prj_U2iHyiwhJlO33r0u4uN65PpdzEiv",
    "cloudflare_account_id": None,
    "worker_name": "bitevo-agent-site",
    "worker_url": "https://bitevo-agent-site.mirokonkr.workers.dev/b1-2/event",
    "d1_database_id": None,
    "rate_limit_namespace_id": None
}
CONTROLS = {
    "network_io": False, "provider_writes": False, "event_posts": False,
    "production_secret_access": False, "install_packages": False,
    "production_runtime_changes": False, "client_activation": False,
    "automatic_retry": False, "execute": False,
    "unknown_outcome": "STOP_READBACK_NO_RETRY",
    "cleanup_semantics": "DISABLE_IS_NOT_DELETE",
    "preview_semantics": "NO_PRODUCTION_ENV_SPOOFING"
}
IDS = set(KNOWN_PRODUCTION)
TOP = {"schema", "mode", "source", "production", "isolated", "inventory", "controls", "plan", "authority"}
EVENTS = {"triage_click", "mailto_click", "scope_generated", "pilot_click"}


class Rejected(ValueError):
    """Fail-closed input/schema error; exception messages contain no raw values."""


def need(condition: bool, code: str) -> None:
    if not condition:
        raise Rejected(code)


def keys(value: Any, expected: set[str], code: str) -> None:
    need(type(value) is dict and set(value) == expected, code)


def integer(value: Any, minimum: int = 0) -> bool:
    return type(value) is int and minimum <= value <= SAFE_INTEGER


def utc(value: Any) -> dt.datetime:
    need(type(value) is str and bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z", value)),
         "UTC_FORMAT")
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise Rejected("UTC_INVALID") from exc


def parse_json(data: bytes) -> dict[str, Any]:
    need(type(data) is bytes and len(data) <= MAX_INPUT_BYTES, "INPUT_BUDGET")

    def unique(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for key, val in pairs:
            need(key not in out, "DUPLICATE_JSON_KEY")
            out[key] = val
        return out

    def constant(_: str) -> None:
        raise Rejected("NON_FINITE_JSON")

    def finite_float(raw: str) -> float:
        value = float(raw)
        need(math.isfinite(value), "NON_FINITE_JSON")
        return value

    try:
        value = json.loads(data.decode("utf-8"), object_pairs_hook=unique,
                           parse_constant=constant, parse_float=finite_float)
    except (UnicodeError, ValueError, RecursionError) as exc:
        if isinstance(exc, Rejected):
            raise
        raise Rejected("INVALID_JSON") from exc
    need(type(value) is dict, "ROOT_OBJECT")
    return value


def identifier(name: str, value: Any) -> None:
    need(type(value) is str and len(value) <= 250 and all(33 <= ord(c) <= 126 for c in value), "RESOURCE_ID_FORMAT")
    if name == "vercel_project_id":
        ok = bool(re.fullmatch(r"prj_[A-Za-z0-9]{8,64}", value))
    elif name == "cloudflare_account_id":
        ok = bool(re.fullmatch(r"[0-9a-f]{32}", value))
    elif name == "worker_name":
        ok = bool(re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", value))
    elif name == "d1_database_id":
        try:
            parsed = uuid.UUID(value)
            ok = str(parsed) == value and parsed.int != 0
        except (ValueError, AttributeError):
            ok = False
    elif name == "rate_limit_namespace_id":
        ok = bool(re.fullmatch(r"[1-9][0-9]{0,18}", value))
    else:
        try:
            u = urlsplit(value)
            ok = (u.scheme == "https" and u.hostname is not None
                  and bool(re.fullmatch(r"[a-z0-9-]+(?:\.[a-z0-9-]+)*\.workers\.dev", u.hostname))
                  and u.netloc == u.hostname and u.port is None
                  and u.username is None and u.password is None
                  and not u.query and not u.fragment and u.path == "/b1-2/event")
        except ValueError:
            ok = False
    need(ok, "RESOURCE_ID_FORMAT")


def validate_row(row: Any, allow_unknown_day: bool = False) -> bool:
    keys(row, {"day", "event_name", "page", "locale"}, "ROW_SCHEMA")
    need(type(row["event_name"]) is str and row["event_name"] in EVENTS, "EVENT_NOT_ALLOWED")
    need(row["locale"] in ("en", "ru") and type(row["locale"]) is str, "LOCALE")
    page = row["page"]
    need(type(page) is str and len(page) <= 180 and bool(re.fullmatch(r"/(?:[a-z0-9-]+(?:/[a-z0-9-]+)*)?", page)),
         "ROW_PATH")
    need(page.startswith("/ru/") == (row["locale"] == "ru"), "ROW_LOCALE_MISMATCH")
    if row["day"] is None and allow_unknown_day:
        return False
    need(type(row["day"]) is str and bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", row["day"])), "ROW_DAY")
    try:
        dt.date.fromisoformat(row["day"])
    except ValueError as exc:
        raise Rejected("ROW_DAY") from exc
    return True


def evaluate_manifest(manifest: Any, now: dt.datetime) -> dict[str, Any]:
    """Validate only an offline proposal. No input field can authorize effects."""
    blocks: list[str] = []

    def present(value: Any, code: str) -> bool:
        if value is None:
            blocks.append(code)
            return False
        return True

    def reference(value: Any, code: str) -> None:
        if present(value, code):
            need(type(value) is str and bool(re.fullmatch(r"urn:[A-Za-z0-9:._/-]{3,190}", value)), "REFERENCE_FORMAT")

    try:
        need(isinstance(now, dt.datetime) and now.tzinfo is not None, "CLOCK_REQUIRED")
        now = now.astimezone(dt.timezone.utc)
        keys(manifest, TOP, "MANIFEST_SCHEMA")
        need(manifest["schema"] == SCHEMA and manifest["mode"] == "OFFLINE_ONLY", "LOCAL_MODE_ONLY")
        need(manifest["source"] == {"repository": REPOSITORY, "commit": BASE, "tree": TREE}, "SOURCE_IDENTITY_DRIFT")
        keys(manifest["controls"], set(CONTROLS), "CONTROL_SCHEMA")
        for name, val in CONTROLS.items():
            need(type(manifest["controls"][name]) is type(val) and manifest["controls"][name] == val,
                 "EFFECT_OR_GUARD_ESCALATION")
        keys(manifest["authority"], {"scope", "provider_execution", "cloud_approval_reference"}, "AUTHORITY_SCHEMA")
        need(manifest["authority"] == {"scope": "LOCAL_ONLY", "provider_execution": False, "cloud_approval_reference": None}
             and manifest["authority"]["provider_execution"] is False, "LIVE_AUTHORITY_NOT_SUPPORTED")
        for group in ("production", "isolated"):
            keys(manifest[group], IDS, "RESOURCE_SCHEMA")
            for name in sorted(IDS):
                value = manifest[group][name]
                if present(value, group.upper() + "_" + name.upper() + "_UNKNOWN"):
                    identifier(name, value)
            if all(manifest[group][x] is not None for x in ("worker_name", "worker_url")):
                need(urlsplit(manifest[group]["worker_url"]).hostname.split(".")[0] == manifest[group]["worker_name"],
                     "WORKER_NAME_URL_MISMATCH")
        for name, fixed in KNOWN_PRODUCTION.items():
            if fixed is not None:
                need(manifest["production"][name] == fixed, "KNOWN_PRODUCTION_ID_DRIFT")
        # A shared account is possible; the workload resources must be disjoint.
        for name in sorted(IDS - {"cloudflare_account_id"}):
            p, t = manifest["production"][name], manifest["isolated"][name]
            if p is not None and t is not None:
                need(p != t, "PRODUCTION_RESOURCE_COLLISION")
        inv = manifest["inventory"]
        keys(inv, {"evidence_kind", "reference", "sha256", "observed_at_utc", "valid_until_utc",
                   "reviewed_by", "exclusive_writer_reference"}, "INVENTORY_SCHEMA")
        need(inv["evidence_kind"] in ("UNVERIFIED", "REFERENCE_ONLY", "SYNTHETIC_FIXTURE"), "UNTRUSTED_EVIDENCE_CLASS")
        if inv["evidence_kind"] == "UNVERIFIED":
            blocks.append("INVENTORY_NOT_VERIFIED")
        for key in ("reference", "reviewed_by", "exclusive_writer_reference"):
            reference(inv[key], "INVENTORY_" + key.upper() + "_UNKNOWN")
        if present(inv["sha256"], "INVENTORY_DIGEST_UNKNOWN"):
            need(type(inv["sha256"]) is str and bool(re.fullmatch(r"[0-9a-f]{64}", inv["sha256"])), "DIGEST_FORMAT")
        times = []
        for key in ("observed_at_utc", "valid_until_utc"):
            times.append(utc(inv[key]) if present(inv[key], "INVENTORY_" + key.upper() + "_UNKNOWN") else None)
        observed, expires = times
        if observed is not None:
            need(observed <= now, "FUTURE_INVENTORY")
        if expires is not None and expires <= now:
            blocks.append("INVENTORY_EXPIRED")
        if observed is not None and expires is not None:
            need(expires > observed, "INVENTORY_WINDOW")
        plan = manifest["plan"]
        keys(plan, {"path", "row", "synthetic_data_only", "desired_positive_delta", "desired_negative_delta",
                    "outcome_unknown", "limits", "rate_limit", "retention", "cleanup"}, "PLAN_SCHEMA")
        need(plan["path"] == "ISOLATED_WORKER_DIRECT_NOT_VERCEL_PREVIEW", "NO_INGRESS_GUARD_BYPASS")
        need(plan["synthetic_data_only"] is True and type(plan["desired_positive_delta"]) is int
             and plan["desired_positive_delta"] == 1 and type(plan["desired_negative_delta"]) is int
             and plan["desired_negative_delta"] == 0 and plan["outcome_unknown"] == "STOP_READBACK_NO_RETRY",
             "TRIAL_BOUNDARY")
        if not validate_row(plan["row"], allow_unknown_day=True):
            blocks.append("ROW_DAY_NOT_AGREED")
        limits = plan["limits"]
        keys(limits, {"event_posts", "total_requests", "response_bytes", "duration_seconds", "cost_minor_units", "currency"},
             "LIMIT_SCHEMA")
        for key in ("event_posts", "total_requests", "response_bytes", "duration_seconds", "cost_minor_units"):
            if present(limits[key], "BUDGET_" + key.upper() + "_UNKNOWN"):
                need(integer(limits[key], 0 if key == "cost_minor_units" else 1), "LIMIT_NUMBER")
        if limits["event_posts"] is not None:
            need(limits["event_posts"] == 1, "ONE_EVENT_PROPOSAL_ONLY")
        if limits["total_requests"] is not None:
            need(limits["total_requests"] >= 3, "READ_WRITE_READ_BUDGET")
        if present(limits["currency"], "CURRENCY_UNKNOWN"):
            need(type(limits["currency"]) is str and bool(re.fullmatch(r"[A-Z]{3}", limits["currency"])), "CURRENCY_FORMAT")
        keys(plan["rate_limit"], {"requests", "period_seconds"}, "RATE_LIMIT_SCHEMA")
        for key, value in plan["rate_limit"].items():
            if present(value, "RATE_" + key.upper() + "_UNKNOWN"):
                need(integer(value, 1), "RATE_LIMIT_NUMBER")
        keys(plan["retention"], {"hours", "owner", "deletion_reference", "access_reference"}, "RETENTION_SCHEMA")
        if present(plan["retention"]["hours"], "RETENTION_HOURS_UNAPPROVED"):
            need(integer(plan["retention"]["hours"], 1), "RETENTION_NUMBER")
        for key in ("owner", "deletion_reference", "access_reference"):
            reference(plan["retention"][key], "RETENTION_" + key.upper() + "_UNKNOWN")
        keys(plan["cleanup"], {"disable_reference", "data_disposition_reference"}, "CLEANUP_SCHEMA")
        for key, value in plan["cleanup"].items():
            reference(value, "CLEANUP_" + key.upper() + "_UNKNOWN")
        return {"schema_valid": True, "readiness": "HOLD" if blocks else "DRY_RUN_COMPLETE",
                "blockers": sorted(set(blocks)), "execution_authorized": False,
                "live_executor": "NOT_IMPLEMENTED", "provider_identity_verified": False,
                "evidence_boundary": "DECLARED_REFERENCE_OR_SYNTHETIC_ONLY"}
    except (Rejected, TypeError, AttributeError, KeyError, ValueError) as exc:
        code = str(exc) if isinstance(exc, Rejected) else "MALFORMED_FIELD"
        return {"schema_valid": False, "readiness": "REJECT", "errors": [code],
                "execution_authorized": False, "live_executor": "NOT_IMPLEMENTED",
                "provider_identity_verified": False}


PACKAGE_PATHS = frozenset("qualification/b12/r47b/" + name for name in (
    "README.md", "manifest.json", "admission.py", "test_admission.py", "expected-observed.json"))
MAX_GIT_BYTES = 2 * 1024 * 1024  # Local read budget, not provider authority.


def object_id(kind: bytes, data: bytes) -> str:
    """Git SHA-1 identity only; run receipts use SHA-256 separately."""
    return hashlib.sha1(kind + b" " + str(len(data)).encode("ascii") + b"\0" + data).hexdigest()


def valid_oid(value: Any) -> bool:
    return type(value) is str and bool(re.fullmatch(r"[0-9a-f]{40}", value)) and value != "0" * 40


def commit_identity(data: bytes, expected: str) -> tuple[str, list[str]]:
    need(type(data) is bytes and len(data) <= MAX_INPUT_BYTES and valid_oid(expected), "GIT_COMMIT_FORMAT")
    need(object_id(b"commit", data) == expected, "GIT_COMMIT_OBJECT_MISMATCH")
    headers = data.split(b"\n\n", 1)[0].split(b"\n")
    trees = [line[5:].decode("ascii") for line in headers if line.startswith(b"tree ")]
    parents = [line[7:].decode("ascii") for line in headers if line.startswith(b"parent ")]
    need(len(trees) == 1 and valid_oid(trees[0]) and all(valid_oid(p) for p in parents), "GIT_COMMIT_HEADER")
    return trees[0], parents


def tree_entries(data: bytes) -> dict[str, tuple[str, str, str]]:
    need(type(data) is bytes and 0 < len(data) <= MAX_GIT_BYTES and data.endswith(b"\0"), "GIT_TREE_FORMAT")
    result: dict[str, tuple[str, str, str]] = {}
    folded: set[str] = set()
    modes = {"100644": "blob", "100755": "blob", "120000": "blob", "160000": "commit"}
    for record in data[:-1].split(b"\0"):
        parts = record.split(b"\t", 1)
        need(len(parts) == 2, "GIT_TREE_RECORD")
        fields = parts[0].decode("ascii").split(" ")
        need(len(fields) == 3, "GIT_TREE_RECORD")
        mode, kind, oid = fields
        path = parts[1].decode("utf-8")
        segments = path.split("/")
        need(mode in modes and modes[mode] == kind and valid_oid(oid), "GIT_TREE_ENTRY")
        need(0 < len(path) <= 512 and "\\" not in path and ":" not in path
             and not any(p in ("", ".", "..") or p.lower() == ".git" for p in segments)
             and all(ord(c) >= 32 for c in path), "GIT_TREE_PATH")
        need(path not in result and path.casefold() not in folded, "GIT_TREE_DUPLICATE")
        result[path] = (mode, kind, oid)
        folded.add(path.casefold())
    need(len(result) <= 10000, "GIT_TREE_BUDGET")
    return result


def tree_identity(entries: dict[str, tuple[str, str, str]]) -> str:
    """Reconstruct the recursive ls-tree root in memory, without writing objects."""
    root: dict[str, Any] = {}
    for path, record in entries.items():
        segments = path.split("/")
        node = root
        for part in segments[:-1]:
            child = node.setdefault(part, {})
            need(type(child) is dict, "GIT_TREE_PATH_COLLISION")
            node = child
        need(segments[-1] not in node, "GIT_TREE_PATH_COLLISION")
        node[segments[-1]] = record

    def digest(node: dict[str, Any]) -> str:
        records = []
        for name, value in node.items():
            is_tree = type(value) is dict
            mode, oid = ("40000", digest(value)) if is_tree else (value[0], value[2])
            key = name.encode("utf-8") + (b"/" if is_tree else b"")
            raw = mode.encode("ascii") + b" " + name.encode("utf-8") + b"\0" + bytes.fromhex(oid)
            records.append((key, raw))
        return object_id(b"tree", b"".join(raw for _, raw in sorted(records)))
    return digest(root)


def evaluate_source_lineage(base_commit: bytes, base_listing: bytes, head: str,
                            head_commit: bytes, head_listing: bytes, status: bytes,
                            package: dict[str, bytes]) -> dict[str, Any]:
    """Local ancestry/scope proof, never an approval of candidate code or effects."""
    base_tree, _ = commit_identity(base_commit, BASE)
    need(base_tree == TREE, "GIT_BASELINE_DRIFT")
    before = tree_entries(base_listing)
    need(tree_identity(before) == TREE, "GIT_BASELINE_TREE_MISMATCH")
    need(not any(p.startswith("qualification/b12/r47b/") for p in before), "GIT_PACKAGE_ALREADY_IN_BASE")
    candidate_tree, parents = commit_identity(head_commit, head)
    after = tree_entries(head_listing)
    need(tree_identity(after) == candidate_tree, "GIT_CANDIDATE_TREE_MISMATCH")
    keys(package, set(PACKAGE_PATHS), "GIT_PACKAGE_SCOPE")
    for content in package.values():
        need(type(content) is bytes and 0 < len(content) <= MAX_INPUT_BYTES
             and b"\r" not in content and b"\0" not in content, "GIT_PACKAGE_CONTENT")
        content.decode("utf-8")
    need(type(status) is bytes and len(status) <= MAX_GIT_BYTES, "GIT_STATUS_FORMAT")
    if head == BASE:
        need(candidate_tree == TREE and after == before, "GIT_BASELINE_DRIFT")
        need(status.endswith(b"\0"), "GIT_LOCAL_PACKAGE_SCOPE")
        rows = status[:-1].split(b"\0")
        need(len(rows) == len(PACKAGE_PATHS), "GIT_LOCAL_PACKAGE_SCOPE")
        names = set()
        phases = set()
        for row in rows:
            need(row[:3] in (b"?? ", b"A  "), "GIT_LOCAL_UNEXPECTED_CHANGE")
            names.add(row[3:].decode("utf-8"))
            phases.add(row[:2])
        need(names == PACKAGE_PATHS and len(phases) == 1, "GIT_LOCAL_PACKAGE_SCOPE")
        mode = "BASELINE_PRECOMMIT"
    else:
        need(parents == [BASE], "GIT_NOT_ONE_DIRECT_PACKAGE_COMMIT")
        need(set(after) - set(before) == PACKAGE_PATHS and set(before) <= set(after), "GIT_COMMITTED_SCOPE")
        need(all(after[p] == record for p, record in before.items()), "GIT_BASELINE_CONTENT_CHANGED")
        need(status == b"", "GIT_COMMITTED_WORKTREE_DIRTY")
        for path, content in package.items():
            need(after[path] == ("100644", "blob", object_id(b"blob", content)), "GIT_PACKAGE_BLOB_MISMATCH")
        mode = "ONE_DIRECT_PACKAGE_COMMIT"
    return {"lineage_mode": mode, "baseline_commit": BASE, "baseline_tree": TREE,
            "git_head": head, "git_tree": candidate_tree, "baseline_entries_checked": len(before),
            "package_files": len(package), "baseline_tree_preserved": True,
            "candidate_review_required": True, "execution_authorized": False}


def local_git(root: Path, *args: str) -> bytes:
    """Fixed internal read calls only; no hooks, fetch, replace objects or lazy fetch."""
    env = dict(os.environ, GIT_OPTIONAL_LOCKS="0", GIT_NO_REPLACE_OBJECTS="1", GIT_NO_LAZY_FETCH="1")
    result = subprocess.run(["git", "--no-optional-locks", "--no-replace-objects", "-c", "core.fsmonitor=false",
                             "-C", str(root), *args], env=env, capture_output=True, timeout=10, check=False)
    need(result.returncode == 0 and len(result.stdout) <= MAX_GIT_BYTES, "GIT_IDENTITY_UNAVAILABLE")
    return result.stdout


def check_source(root: Path) -> dict[str, Any]:
    """Verify pinned baseline or one scope-exact child; never persist Git objects."""
    failed: list[str] = []
    root = root.resolve(strict=True)
    for path, digest in PROTECTED_SHA256.items():
        p = root / path
        if not p.is_file() or p.is_symlink() or root not in p.resolve().parents:
            failed.append(path)
            continue
        data = p.read_bytes().replace(b"\r\n", b"\n")
        if hashlib.sha256(data).hexdigest() != digest:
            failed.append(path)
    head = local_git(root, "rev-parse", "--verify", "HEAD").decode("ascii").strip()
    need(valid_oid(head), "GIT_BASELINE_DRIFT")
    base_commit = local_git(root, "cat-file", "commit", BASE)
    base_listing = local_git(root, "ls-tree", "-r", "-z", "--full-tree", TREE)
    head_commit = base_commit if head == BASE else local_git(root, "cat-file", "commit", head)
    candidate_tree, _ = commit_identity(head_commit, head)
    head_listing = base_listing if head == BASE else local_git(root, "ls-tree", "-r", "-z", "--full-tree", candidate_tree)
    package = {}
    for path in sorted(PACKAGE_PATHS):
        p = root / path
        need(p.is_file() and not p.is_symlink() and root in p.resolve().parents, "GIT_PACKAGE_FILE_UNSAFE")
        need(all(not parent.is_symlink() for parent in p.parents if parent != root and root in parent.parents),
             "GIT_PACKAGE_PARENT_SYMLINK")
        with p.open("rb") as stream:
            content = stream.read(MAX_INPUT_BYTES + 1)
        need(len(content) <= MAX_INPUT_BYTES, "GIT_PACKAGE_CONTENT_BUDGET")
        package[path] = content.replace(b"\r\n", b"\n")
    status = local_git(root, "status", "--porcelain=v1", "-z", "--untracked-files=all")
    lineage = evaluate_source_lineage(base_commit, base_listing, head, head_commit, head_listing, status, package)
    need(local_git(root, "rev-parse", "--verify", "HEAD").decode("ascii").strip() == head, "GIT_HEAD_CHANGED_DURING_READ")
    return {"protected_content_match": not failed, "files_checked": len(PROTECTED_SHA256),
            "failed_paths": failed, **lineage}


def evaluate_trace(trace: Any, row: dict[str, Any], target: dict[str, Any] | None = None) -> dict[str, Any]:
    """Evaluate synthetic observations; do not write or certify Cloudflare."""
    result = {"simulation_result": "REJECT", "real_provider_proven": False, "retry_allowed": False,
              "execution_authorized": False, "exactly_once_proven": False}
    try:
        validate_row(row)
        keys(target, IDS, "TARGET_CONTEXT_REQUIRED")
        for name, value in target.items():
            identifier(name, value)
            if name != "cloudflare_account_id" and KNOWN_PRODUCTION[name] is not None:
                need(value != KNOWN_PRODUCTION[name], "PRODUCTION_RESOURCE_COLLISION")
        need(urlsplit(target["worker_url"]).hostname.split(".")[0] == target["worker_name"],
             "WORKER_NAME_URL_MISMATCH")
        keys(trace, {"kind", "exclusive_writer", "before", "receipt", "after"}, "TRACE_SCHEMA")
        need(trace["kind"] == "SYNTHETIC_MEMORY" and trace["exclusive_writer"] is True, "ISOLATION_NOT_PROVEN")
        for name in ("before", "after"):
            obs = trace[name]
            keys(obs, {"row", "count", "complete", "reader", "at", "resource"}, "OBSERVATION_SCHEMA")
            need(obs["resource"] == target, "READBACK_TARGET_MISMATCH")
            need(obs["row"] == row and obs["complete"] is True and obs["reader"] == "INDEPENDENT_SIMULATED",
                 "READBACK_NOT_INDEPENDENT_OR_COMPLETE")
            need(integer(obs["count"]), "COUNT_UNKNOWN_OR_INVALID")
        need(utc(trace["after"]["at"]) > utc(trace["before"]["at"]), "OBSERVATION_ORDER")
        receipt = trace["receipt"]
        keys(receipt, {"outcome", "status", "ok", "counted", "success", "changes", "resource"}, "RECEIPT_SCHEMA")
        need(receipt["resource"] == target, "RECEIPT_TARGET_MISMATCH")
        if receipt["outcome"] == "UNKNOWN":
            result.update(simulation_result="HOLD", reason="UNKNOWN_WRITE_STOP_READBACK_NO_RETRY")
            return result
        delta = trace["after"]["count"] - trace["before"]["count"]
        if receipt["outcome"] == "CONFIRMED":
            need(type(receipt["status"]) is int and receipt["status"] == 200 and receipt["ok"] is True
                 and receipt["counted"] is True and receipt["success"] is True
                 and type(receipt["changes"]) is int and receipt["changes"] == 1, "WRITE_RECEIPT_UNCONFIRMED")
            need(delta == 1, "POSITIVE_DELTA_NOT_ONE")
        else:
            need(receipt["outcome"] == "REJECTED" and type(receipt["status"]) is int
                 and receipt["status"] in (400, 401, 403, 404, 405, 413, 415, 429)
                 and receipt["ok"] is False and receipt["counted"] is False
                 and receipt["success"] is False and type(receipt["changes"]) is int
                 and receipt["changes"] == 0, "NEGATIVE_NOT_CONFIRMED")
            need(delta == 0, "NEGATIVE_DELTA_NOT_ZERO")
        result.update(simulation_result="PASS", delta=delta)
    except (Rejected, TypeError, ValueError, KeyError) as exc:
        result["reason"] = str(exc) if isinstance(exc, Rejected) else "MALFORMED_TRACE"
    return result


def evaluate_budget(limits: Any, used: Any, proposed: Any) -> dict[str, Any]:
    """Arithmetic for a proposed future attempt, never a provider authorization."""
    names = {"event_posts", "total_requests", "response_bytes", "duration_seconds", "cost_minor_units"}
    result = {"within_declared_budget": False, "execution_authorized": False}
    try:
        for values in (limits, used, proposed):
            keys(values, names, "BUDGET_SCHEMA")
            need(all(integer(v) for v in values.values()), "BUDGET_NOT_FINITE_INTEGER")
        need(limits["event_posts"] == 1 and limits["total_requests"] >= 3, "TRIAL_BUDGET")
        need(proposed["event_posts"] <= proposed["total_requests"], "POST_REQUEST_ACCOUNTING")
        need(used["event_posts"] <= used["total_requests"], "POST_REQUEST_ACCOUNTING")
        result["within_declared_budget"] = all(
            used[k] <= limits[k] and proposed[k] <= limits[k] - used[k] for k in names)
        result["reason"] = "OFFLINE_ARITHMETIC_ONLY" if result["within_declared_budget"] else "BUDGET_EXHAUSTED"
    except (Rejected, TypeError, ValueError, KeyError) as exc:
        result["reason"] = str(exc) if isinstance(exc, Rejected) else "MALFORMED_BUDGET"
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Offline-only R47B: JSON to stdout; never executes provider actions.")
    parser.add_argument("--manifest", type=Path, default=Path(__file__).with_name("manifest.json"))
    parser.add_argument("--root", type=Path, required=True)
    args = parser.parse_args()
    try:
        with args.manifest.open("rb") as stream:
            manifest = parse_json(stream.read(MAX_INPUT_BYTES + 1))
        out = evaluate_manifest(manifest, dt.datetime.now(dt.timezone.utc))
        out["source"] = check_source(args.root)
        if not out["source"]["protected_content_match"]:
            out.update(readiness="REJECT", errors=["PROTECTED_CONTENT_DRIFT"])
        print(json.dumps(out, ensure_ascii=True, sort_keys=True))
        return 0 if out["readiness"] == "DRY_RUN_COMPLETE" else 2 if out["readiness"] == "HOLD" else 3
    except (OSError, Rejected, subprocess.SubprocessError, UnicodeError) as exc:
        print(json.dumps({"readiness": "REJECT", "error": str(exc) if isinstance(exc, Rejected) else type(exc).__name__,
                          "execution_authorized": False}))
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
