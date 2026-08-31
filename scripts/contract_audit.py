"""Contract & Coverage Audit — Open Learning OS (stdlib-only, read-only).

Purpose (maps to GPT P0-3 / P0-4):
  P0-3  OpenAPI(88 endpoint) -> test reference 1:1 machine-auditable map.
  P0-4  Detect shared/types/*.ts camelCase keys = likely snake_case contract drift
        (the refId / ref_id class of bug).

Read-only: imports the FastAPI app to read its OpenAPI schema (no server start),
and scans the repo text. Nothing is written to the DB or workspace.

Usage (from repo root learning-os/):
  server\\.venv\\Scripts\\python.exe scripts\\contract_audit.py

Exit code: 0 always (audit, not a gate). We only report; gating is a policy decision.
"""
from __future__ import annotations

import os
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # learning-os/
SERVER_DIR = ROOT / "server"
TESTS_DIR = SERVER_DIR / "tests"
TYPES_DIR = ROOT / "shared" / "types"

METHOD_RE = re.compile(r"\b(GET|POST|PUT|PATCH|DELETE)\b")


def load_openapi_paths() -> list[tuple[str, str, str]]:
    """Return (method, path, operation_id) for every /api/v1 endpoint."""
    sys.path.insert(0, str(SERVER_DIR))
    # Import lazily so we only touch FastAPI app for schema intro (no lifespan/db).
    from app.main import create_app  # type: ignore

    app = create_app()
    schema = app.openapi()
    out = []
    for path, ops in schema.get("paths", {}).items():
        if not path.startswith("/api/v1"):
            continue
        for method in ("get", "post", "put", "patch", "delete"):
            if method in ops:
                op_id = ops[method].get("operationId", "")
                out.append((method.upper(), path, op_id))
    out.sort(key=lambda t: (t[1], t[0]))
    return out


def normalize(path: str) -> str:
    """'...,/notes/{note_id}' -> '/notes/*' ; keep a second literal variant."""
    p = re.sub(r"\{[^}]+\}", "*", path)
    return p


def test_files() -> list[Path]:
    return [p for p in TESTS_DIR.rglob("*.py") if "__pycache__" not in p.parts]


def path_regex(path: str) -> re.Pattern[str]:
    """Match a route path whether tests use {id} templates or literal ids
    (e.g. '/api/v1/mindmaps/{map_id}/export' vs '.../123/export'). Static chunks
    are regex-escaped; each '{param}' becomes [^/]+."""
    chunks = re.split(r"\{[^}]+\}", path)
    return re.compile("[^/]+".join(re.escape(c) for c in chunks))


def endpoint_referenced(method: str, path: str, texts: dict[Path, str]) -> list[Path]:
    """Path-presence across the test tree (template/literal aware). This is the
    primary 'there is SOME test touching this route' signal. Method is reported
    separately; a route may be exercised by a fixture/helper rather than a direct
    client.<method> call, so method-level certainty is deliberately downgraded."""
    rx = path_regex(path)
    return [f for f, text in texts.items() if rx.search(text)]


def camel_keys(ts_text: str) -> list[str]:
    """Return camelCase property keys that backend/snake_case convention would
    render as snake_case (e.g. refId -> ref_id). Exclude known single-lowercase."""
    keys = set()
    for m in re.finditer(r"([a-zA-Z_][a-zA-Z0-9_]*)\s*:", ts_text):
        k = m.group(1)
        # camelCase = starts lowercase / '_' then contains an uppercase.
        if re.search(r"[a-z][A-Z]", k) or re.match(r"^_[a-z][A-Z]", k):
            keys.add(k)
    return sorted(keys)


def snake_for(k: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", k).lower()


def main() -> int:
    texts = {f: f.read_text(encoding="utf-8", errors="replace") for f in test_files()}
    endpoints = load_openapi_paths()
    print(f"# OpenAPI endpoints:\t{len(endpoints)}")
    print(f"# Test files scanned:\t{len(texts)}")
    print(f"# TS type files:\t{len(list(TYPES_DIR.glob('*.ts')))}")
    print()

    # ---- P0-3: endpoint -> test reference map ----
    print("## P0-3 Endpoint -> Test Reference (path-presence, param-aware)")
    print("METHOD\tPATH\t\tREF\tFILES")
    no_ref = []
    by_file = defaultdict(list)
    for method, path, _opid in endpoints:
        hits = endpoint_referenced(method, path, texts)
        ref = "Y" if hits else "N"
        fname = ";".join(p.name for p in hits) if hits else "-"
        print(f"{method}\t{path}\t{ref}\t{fname}")
        if not hits:
            no_ref.append((method, path))
        for p in hits:
            by_file[p].append(f"{method} {path}")

    print()
    print(f"## P0-3 no-path-match candidates ({len(no_ref)})  [no test text touches this path]")
    for method, path in no_ref:
        print(f"  {method} {path}")
    print()
    print("## P0-3 Test files and endpoint count they touch (top)")
    for p, eps in sorted(by_file.items(), key=lambda kv: -len(kv[1])):
        print(f"  {len(eps):>3}\t{p}")

    # ---- P0-4: shared/types cif-style camelCase drift scan ----
    print()
    print("## P0-4 shared/types/*.ts camelCase key drift scan")
    found = 0
    for ts in sorted(TYPES_DIR.glob("*.ts")):
        keys = camel_keys(ts.read_text(encoding="utf-8", errors="replace"))
        if keys:
            found += 1
            print(f"## {ts.name}")
            for k in keys:
                print(f"  {k}   -> snake: {snake_for(k)}")
    if not found:
        print("  (no camelCase keys detected)")

    print()
    print("## Notes")
    print("  - P0-3 'REF' = the route path appears in >=1 test file (regex, param/literal aware).")
    print("    Absence ('N') means NO test text references that path => strong signal it is")
    print("    uncovered OR exercised via a helper that never spells the full URL.")
    print("    Treat 'N' as an actionable candidate for the 89-endpoint coverage audit.")
    print("  - P0-4 flags camelCase keys as potential snake_case contract drift;")
    print("    confirm each against backend Pydantic/tutor response before changing.")
    print("  - OpenAPI endpoint count is authoritative from app.openapi() — if it differs")
    print("    from docs (88), the docs need updating (P0-1 baseline consistency).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
