#!/usr/bin/env python3
"""
verify_audit.py — Reference implementation of the CI gate verification contract.

Adapt to your repo:
  - VERSION_FILE / how to read the project's declared version
  - CLAIMS_DOC path
  - AUDITS_DIR / EXCEPTIONS path
  - SBOM_DIR (T2+)
  - Tier-specific required keys & sections

Exit codes:
  0  — pass; PR may merge
  1  — failed check(s); see stderr for structured error list
  2  — usage / configuration error

This script does NOT modify any files. It is a pure verifier.

Required: PyYAML. The script refuses to run without it — a naive fallback YAML
parser would silently mishandle list values like `exceptions_cited: ["X"]`,
which is more dangerous than failing loudly.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    print(
        "FATAL: PyYAML is required. Install with: pip install pyyaml",
        file=sys.stderr,
    )
    sys.exit(2)


# --- Customize per-repo -----------------------------------------------------

VERSION_FILE = "pyproject.toml"  # or package.json, Cargo.toml, etc.
CLAIMS_DOC_CANDIDATES = ["docs/SECURITY.md", "SECURITY.md"]
AUDITS_DIR = ".security/audits"
EXCEPTIONS_PATH = ".security/audits/exceptions.json"
KNOWN_ISSUES_PATH = ".security/audits/KNOWN-ISSUES.md"  # T1 alternative
SBOM_DIR = "sbom"


# Required front-matter keys by tier
REQUIRED_KEYS_BY_TIER = {
    0: ["release", "audit_tier", "audited_at", "auditor", "status"],
    1: [
        "release",
        "audit_tier",
        "commit_sha",
        "audited_at",
        "auditor",
        "status",
        "sources_sha256",
        "deps_sha256",
        "claims_sha256",
    ],
    2: [
        "release",
        "audit_tier",
        "commit_sha",
        "audited_at",
        "auditor",
        "approver",
        "status",
        "sources_sha256",
        "deps_sha256",
        "claims_sha256",
        "sbom_ref",
        "attestation_ref",
    ],
    3: [
        "release",
        "audit_tier",
        "commit_sha",
        "audited_at",
        "auditor",
        "approver",
        "status",
        "sources_sha256",
        "deps_sha256",
        "claims_sha256",
        "sbom_ref",
        "attestation_ref",
        "threat_model_ref",
        "threat_model_last_refreshed",
    ],
}

REQUIRED_SECTIONS_BY_TIER = {
    0: ["Sign-Off"],
    1: ["Scope", "Methodology", "Findings", "Dependency Audit", "Sign-Off"],
    2: [
        "Scope",
        "Methodology",
        "Claims Verification",
        "Findings",
        "Dependency Audit",
        "Accepted Risks",
        "Build Attestation",
        "SBOM Reference",
        "Sign-Off",
    ],
    3: [
        "Scope",
        "Methodology",
        "Claims Verification",
        "Findings",
        "Dependency Audit",
        "Accepted Risks",
        "Build Attestation",
        "SBOM Reference",
        "Framework Mapping",
        "Sign-Off",
    ],
}

# Patterns to flag as un-filled-in template text. Scanned in BOTH the body
# AND the front matter (template auditor: "<REPLACE WITH NAME>" must not slip
# through just because it's a non-empty string).
PLACEHOLDER_PATTERNS = [
    re.compile(r"<REPLACE\s+WITH", re.IGNORECASE),
    re.compile(r"<TODO", re.IGNORECASE),
    re.compile(r"<NAME>", re.IGNORECASE),
    re.compile(r"REPLACE\s+WITH\s+ISO\s*8601", re.IGNORECASE),
]


# --- Errors -----------------------------------------------------------------


class VerifyError(Exception):
    """A single failed check."""


def fail(errors: list[str], msg: str) -> None:
    errors.append(msg)


# --- YAML front matter ------------------------------------------------------

# Match the opening `---\n` line, content, then a `---` line.
FRONT_MATTER_RE = re.compile(r"\A---\s*\n(.*?)\n---\s*(?:\n|\Z)", re.DOTALL)


def parse_front_matter(text: str) -> tuple[dict, str, str]:
    """
    Returns (front_matter_dict, front_matter_raw_text, body).
    front_matter_raw_text is the unparsed YAML text — used for placeholder scan.
    """
    m = FRONT_MATTER_RE.match(text)
    if not m:
        raise VerifyError(
            "audit document has no YAML front matter (must start with `---`)"
        )
    fm_text = m.group(1)
    body = text[m.end() :]
    try:
        fm = yaml.safe_load(fm_text) or {}
    except yaml.YAMLError as e:
        raise VerifyError(f"front matter is not valid YAML: {e}")
    if not isinstance(fm, dict):
        raise VerifyError(
            f"front matter must be a YAML mapping; got {type(fm).__name__}"
        )
    return fm, fm_text, body


# --- Checks -----------------------------------------------------------------


def read_claims_tier(repo: Path) -> int:
    for candidate in CLAIMS_DOC_CANDIDATES:
        path = repo / candidate
        if path.exists():
            text = path.read_text(encoding="utf-8")
            m = re.search(r"audit_tier:\s*([0-3])", text)
            if m:
                return int(m.group(1))
            # Fallback: infer from "Tier <N>" in the text.
            m = re.search(r"\bTier\s+([0-3])\b", text)
            if m:
                return int(m.group(1))
    raise VerifyError(
        f"Could not determine tier from claims doc. Looked in: {CLAIMS_DOC_CANDIDATES}"
    )


def read_project_version(repo: Path) -> str:
    """
    Extract the project version. Customize per project.
    Tries pyproject.toml, then package.json, then Cargo.toml.
    """
    pyproj = repo / "pyproject.toml"
    if pyproj.exists():
        text = pyproj.read_text(encoding="utf-8")
        m = re.search(r'^version\s*=\s*"([^"]+)"', text, re.MULTILINE)
        if m:
            return m.group(1)

    pkg = repo / "package.json"
    if pkg.exists():
        try:
            data = json.loads(pkg.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            raise VerifyError(f"package.json is not valid JSON: {e}")
        if "version" in data:
            return data["version"]

    cargo = repo / "Cargo.toml"
    if cargo.exists():
        text = cargo.read_text(encoding="utf-8")
        m = re.search(r'^version\s*=\s*"([^"]+)"', text, re.MULTILINE)
        if m:
            return m.group(1)

    raise VerifyError(
        "Could not determine project version. "
        "Edit verify_audit.py read_project_version() for your project's manifest."
    )


def find_audit_file(repo: Path, version: str) -> Path:
    """Find .security/audits/<version>.md or revisions of it."""
    audits = repo / AUDITS_DIR
    if not audits.is_dir():
        raise VerifyError(f"audits directory not found: {audits}")
    direct = audits / f"{version}.md"
    if direct.exists():
        return direct
    # Look for revisions like "1.2.3-r2.md"; numeric-sort the suffix.
    rev_re = re.compile(rf"^{re.escape(version)}-r(\d+)\.md$")
    revisions: list[tuple[int, Path]] = []
    for p in audits.iterdir():
        m = rev_re.match(p.name)
        if m:
            revisions.append((int(m.group(1)), p))
    if revisions:
        revisions.sort()
        return revisions[-1][1]
    raise VerifyError(f"missing {AUDITS_DIR}/{version}.md (no revisions found either)")


def check_keys(fm: dict, tier: int, errors: list[str]) -> None:
    required = REQUIRED_KEYS_BY_TIER.get(tier, [])
    for key in required:
        val = fm.get(key)
        if val is None or val == "" or val == []:
            fail(errors, f"front matter is missing or empty: {key}")


def check_sections(body: str, tier: int, errors: list[str]) -> None:
    required = REQUIRED_SECTIONS_BY_TIER.get(tier, [])
    for sec in required:
        # Section name match is case-sensitive; word-boundary at end allows
        # `## Build Attestation (T2+)` style suffixes.
        if not re.search(rf"^##\s+{re.escape(sec)}\b", body, re.MULTILINE):
            fail(errors, f"required section missing: ## {sec}")


def check_placeholders(text: str, where: str, errors: list[str]) -> None:
    """Scan `text` for un-filled-in template placeholders. Reports first per pattern."""
    for pat in PLACEHOLDER_PATTERNS:
        m = pat.search(text)
        if m:
            snippet = text[max(0, m.start() - 20) : m.end() + 20]
            fail(errors, f"placeholder still present in {where}: {snippet!r}")


def check_status(fm: dict, errors: list[str]) -> None:
    status = fm.get("status")
    if fm.get("historical") is True:
        return  # historical artifacts skip the gate
    if status not in ("approved", "conditional"):
        fail(errors, f"status is {status!r}; must be 'approved' or 'conditional'")


def check_tier_match(fm: dict, claims_tier: int, errors: list[str]) -> None:
    audit_tier = fm.get("audit_tier")
    if audit_tier != claims_tier:
        fail(
            errors,
            f"audit_tier ({audit_tier}) does not match claims document tier ({claims_tier})",
        )


def check_version_match(fm: dict, project_version: str, errors: list[str]) -> None:
    release = fm.get("release")
    if release == project_version:
        return
    # Accept revision suffix (e.g., release=1.2.3-r2 while project version is 1.2.3).
    if isinstance(release, str) and release.startswith(project_version + "-r"):
        return
    fail(
        errors,
        f"audit release ({release}) does not match project version ({project_version})",
    )


def check_separation_of_duties(fm: dict, tier: int, errors: list[str]) -> None:
    if tier < 2:
        return
    auditor = fm.get("auditor")
    approver = fm.get("approver")
    if auditor and approver and auditor == approver:
        fail(
            errors,
            f"separation of duties: auditor and approver must differ (both {auditor!r})",
        )


def load_exceptions(repo: Path) -> dict:
    path = repo / EXCEPTIONS_PATH
    if not path.exists():
        return {"exceptions": []}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise VerifyError(f"{EXCEPTIONS_PATH} is not valid JSON: {e}")


def check_exceptions_cited(fm: dict, repo: Path, tier: int, errors: list[str]) -> None:
    cited = fm.get("exceptions_cited") or []
    if not isinstance(cited, list):
        fail(errors, f"exceptions_cited must be a list; got {type(cited).__name__}")
        return
    if not cited:
        return
    if tier < 2:
        # T1 uses KNOWN-ISSUES.md; verify cited IDs appear in the file.
        path = repo / KNOWN_ISSUES_PATH
        if not path.exists():
            fail(errors, f"exceptions cited but {KNOWN_ISSUES_PATH} does not exist")
            return
        text = path.read_text(encoding="utf-8")
        for exc_id in cited:
            if exc_id not in text:
                fail(
                    errors,
                    f"cited exception {exc_id!r} not found in {KNOWN_ISSUES_PATH}",
                )
        return

    try:
        data = load_exceptions(repo)
    except VerifyError as e:
        fail(errors, str(e))
        return
    by_id = {e.get("id"): e for e in data.get("exceptions", [])}
    now = datetime.now(timezone.utc)
    for exc_id in cited:
        e = by_id.get(exc_id)
        if not e:
            fail(errors, f"cited exception {exc_id!r} not found in {EXCEPTIONS_PATH}")
            continue
        expires = e.get("expires_at")
        if not expires:
            fail(errors, f"exception {exc_id!r} has no expires_at")
            continue
        try:
            expiry = datetime.fromisoformat(str(expires).replace("Z", "+00:00"))
        except ValueError:
            fail(errors, f"exception {exc_id!r} expires_at not ISO 8601: {expires!r}")
            continue
        if expiry <= now:
            fail(errors, f"exception {exc_id!r} expired on {expires}")


def check_sbom(fm: dict, repo: Path, tier: int, errors: list[str]) -> None:
    if tier < 2:
        return
    ref = fm.get("sbom_ref")
    if not ref:
        return  # missing-key check covered elsewhere
    path = repo / ref
    if not path.exists():
        fail(errors, f"sbom_ref points to missing file: {ref}")
        return
    # If front matter declares an sbom_sha256, verify it matches.
    declared = fm.get("sbom_sha256")
    if declared:
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != declared:
            fail(errors, f"sbom_sha256 mismatch: declared {declared}, actual {actual}")


def check_hashes(fm: dict, repo: Path, errors: list[str]) -> None:
    """
    Recompute hashes using hash_manifest.py and compare.
    Skipped when no hash script exists (e.g., Mode A repos use git tree-hash).
    """
    hash_script = repo / "scripts" / "hash_manifest.py"
    if not hash_script.exists():
        return

    try:
        out = subprocess.run(
            [sys.executable, str(hash_script), "--root", str(repo), "--format", "json"],
            capture_output=True,
            text=True,
            check=True,
            timeout=120,
        )
    except subprocess.CalledProcessError as e:
        fail(
            errors,
            f"hash recomputation failed (exit {e.returncode}): {e.stderr[:400]!r}",
        )
        return
    except subprocess.TimeoutExpired:
        fail(errors, "hash recomputation timed out after 120s")
        return

    try:
        computed = json.loads(out.stdout)
    except json.JSONDecodeError as e:
        fail(errors, f"hash_manifest.py did not produce valid JSON: {e}")
        return

    for key in (
        "manifest_sha256",
        "sources_sha256",
        "deps_sha256",
        "claims_sha256",
        "build_sha256",
    ):
        declared = fm.get(key)
        computed_val = computed.get(key)
        if declared and computed_val and declared != computed_val:
            fail(
                errors,
                f"{key} mismatch: declared {declared}, recomputed {computed_val}",
            )


# --- Main -------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Verify a security audit document against its repo."
    )
    parser.add_argument(
        "--repo", type=Path, default=Path.cwd(), help="Repo root (default: cwd)"
    )
    parser.add_argument(
        "--version",
        default=None,
        help="Override project version (otherwise read from manifest)",
    )
    args = parser.parse_args()

    repo = args.repo.resolve()
    errors: list[str] = []

    try:
        claims_tier = read_claims_tier(repo)
    except VerifyError as e:
        print(f"FATAL: {e}", file=sys.stderr)
        return 2

    try:
        version = args.version or read_project_version(repo)
    except VerifyError as e:
        print(f"FATAL: {e}", file=sys.stderr)
        return 2

    try:
        audit_path = find_audit_file(repo, version)
    except VerifyError as e:
        print(f"FAIL: {e}", file=sys.stderr)
        return 1

    text = audit_path.read_text(encoding="utf-8")
    try:
        fm, fm_raw, body = parse_front_matter(text)
    except VerifyError as e:
        print(f"FAIL: {audit_path}: {e}", file=sys.stderr)
        return 1

    tier = fm.get("audit_tier", claims_tier)
    if not isinstance(tier, int) or tier not in (0, 1, 2, 3):
        fail(errors, f"audit_tier must be one of 0,1,2,3; got {tier!r}")
        tier = claims_tier  # continue with claims tier for further checks

    check_keys(fm, tier, errors)
    check_sections(body, tier, errors)
    # Scan placeholders in BOTH front matter and body — a non-empty placeholder
    # like `auditor: "<REPLACE WITH NAME>"` would otherwise slip through.
    check_placeholders(fm_raw, "front matter", errors)
    check_placeholders(body, "body", errors)
    check_status(fm, errors)
    check_tier_match(fm, claims_tier, errors)
    check_version_match(fm, version, errors)
    check_separation_of_duties(fm, tier, errors)
    check_exceptions_cited(fm, repo, tier, errors)
    check_sbom(fm, repo, tier, errors)
    check_hashes(fm, repo, errors)

    if errors:
        print(f"FAIL: {audit_path}", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        print(f"\n{len(errors)} check(s) failed.", file=sys.stderr)
        return 1

    print(f"PASS: {audit_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
