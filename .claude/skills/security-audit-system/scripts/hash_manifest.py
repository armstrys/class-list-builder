#!/usr/bin/env python3
"""
hash_manifest.py — Deterministic SHA-256 manifest hashing (Mode B).

Reference implementation. Adapt the component-group config to your repo.
For Mode A (git tree hash binding), see references/hashing.md — verification is
just `git rev-parse <commit>^{tree}` and no separate script is needed.

This script:
  - Walks declared component groups (sources, deps, claims, build)
  - Computes per-file SHA-256 over raw bytes
  - Builds a deterministic manifest per group: sorted, LF endings, NFC paths
  - Outputs per-group sub-hashes and an overall manifest hash
  - Writes manifests to disk for review (--manifests-dir)
  - Outputs YAML-ready hash block for pasting into an audit's front matter

Cross-platform determinism: enforces LF, NFC-normalizes paths, byte-sorts.

Glob semantics (important):
  - Include patterns use pathlib.Path.glob() semantics:
      * `**` matches zero or more directory components
      * `*` matches a single path component (no slashes)
      * `src/**/*.py` matches `src/main.py` AND `src/a/b.py`
  - Brace expansion `{a,b,c}` is supported as a convenience (e.g. `*.{js,ts}`
    expands to `*.js`, `*.ts`). Nested braces are expanded recursively.
  - Exclude patterns are matched against the relative-path string using a
    glob-to-regex translator in this file, where `**` correctly matches across
    path separators (the Python stdlib `fnmatch` module does NOT).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import unicodedata
from pathlib import Path

try:
    import yaml  # PyYAML; many repos already have it. If not, prefer JSON config.
except ImportError:
    yaml = None


# --- Configuration ----------------------------------------------------------

# Default config — override via --config <path>.
# This is the ONE thing each repo customizes. Edit before running.
DEFAULT_CONFIG = {
    "components": {
        "sources": {
            "include": ["src/**/*.py", "src/**/*.js", "src/**/*.ts"],
            "exclude": ["**/__pycache__/**", "**/*.pyc", "**/test_*.py"],
        },
        "deps": {
            "include": [
                "pyproject.toml",
                "poetry.lock",
                "requirements.txt",
                "package.json",
                "package-lock.json",
                "yarn.lock",
                "Cargo.toml",
                "Cargo.lock",
                "go.mod",
                "go.sum",
            ],
            "exclude": [],
        },
        "claims": {
            "include": ["docs/SECURITY.md", "SECURITY.md"],
            "exclude": [],
        },
        "build": {
            "include": [
                "Makefile",
                "Dockerfile",
                ".github/workflows/release.yml",
                "build.sh",
            ],
            "exclude": [],
        },
    },
    "exclude_global": [
        ".git/**",
        "node_modules/**",
        "dist/**",
        "build/**",
        ".venv/**",
        "venv/**",
        "**/.DS_Store",
        "**/*.swp",
        ".security/audits/**",  # don't hash the audits themselves
        "sbom/**",
    ],
}


# --- Determinism helpers ----------------------------------------------------


def nfc(p: str) -> str:
    """Unicode NFC normalize a path string."""
    return unicodedata.normalize("NFC", p)


def to_posix(p: Path) -> str:
    """Forward-slash POSIX-style path string, NFC-normalized."""
    return nfc(str(p).replace(os.sep, "/"))


# --- Glob expansion ---------------------------------------------------------

_BRACE_RE = re.compile(r"\{([^{}]+)\}")


def expand_braces(pattern: str) -> list[str]:
    """
    Expand `{a,b,c}` brace groups in `pattern` into multiple patterns.
    Nested braces are expanded recursively.
    If no braces are present, returns [pattern].
    """
    m = _BRACE_RE.search(pattern)
    if not m:
        return [pattern]
    prefix = pattern[: m.start()]
    suffix = pattern[m.end() :]
    options = [opt.strip() for opt in m.group(1).split(",")]
    expanded: list[str] = []
    for opt in options:
        for sub in expand_braces(prefix + opt + suffix):
            expanded.append(sub)
    return expanded


def _glob_to_regex(pattern: str) -> re.Pattern[str]:
    """
    Translate a glob pattern to a regex, with `**` matching across path
    separators and `*` matching a single path component.
    Used for matching exclude patterns against relative-path strings.
    """
    i = 0
    out: list[str] = []
    while i < len(pattern):
        c = pattern[i]
        if c == "*" and i + 1 < len(pattern) and pattern[i + 1] == "*":
            # `**` matches anything including slashes.
            i += 2
            # If followed by `/`, treat `**/` as "zero or more dir components" so
            # `**/foo` matches `foo` and `a/foo` and `a/b/foo`.
            if i < len(pattern) and pattern[i] == "/":
                out.append("(?:.*/)?")
                i += 1
            else:
                out.append(".*")
        elif c == "*":
            out.append("[^/]*")
            i += 1
        elif c == "?":
            out.append("[^/]")
            i += 1
        elif c in r".^$+(){}|\\":
            out.append("\\" + c)
            i += 1
        else:
            out.append(c)
            i += 1
    return re.compile("\\A" + "".join(out) + "\\Z")


def matches_any_exclude(path_str: str, patterns: list[str]) -> bool:
    """
    Match a relative-path string against any of the exclude patterns.
    Brace expansion is applied first.
    """
    p = nfc(path_str)
    for raw in patterns:
        for pat in expand_braces(raw):
            if _glob_to_regex(nfc(pat)).match(p):
                return True
    return False


def collect_paths(
    root: Path,
    include_patterns: list[str],
    exclude_patterns: list[str],
    exclude_global: list[str],
) -> list[str]:
    """
    Collect files matching include_patterns (via pathlib.Path.glob), minus
    exclude_patterns and exclude_global.

    Returns: NFC-normalized POSIX-style relative paths, byte-sorted.
    """
    found: set[str] = set()

    # Expand braces in include patterns since pathlib.glob doesn't support them.
    expanded_includes: list[str] = []
    for raw in include_patterns:
        expanded_includes.extend(expand_braces(raw))

    for pattern in expanded_includes:
        # pathlib.Path.glob:
        #   * `**` matches zero or more directory components (Python 3.5+)
        #   * `*` matches a single path component (no slashes)
        try:
            matches = list(root.glob(pattern))
        except (OSError, NotImplementedError) as e:
            print(f"# warning: glob {pattern!r} failed: {e}", file=sys.stderr)
            continue

        for match in matches:
            # Accept regular files and symlinks; skip directories.
            if not (match.is_file() or match.is_symlink()):
                continue
            try:
                rel = match.relative_to(root)
            except ValueError:
                continue
            rel_str = to_posix(rel)
            if matches_any_exclude(rel_str, exclude_global):
                continue
            if matches_any_exclude(rel_str, exclude_patterns):
                continue
            found.add(rel_str)

    # Byte-sort (NOT locale-aware) for deterministic ordering across platforms.
    return sorted(found, key=lambda s: s.encode("utf-8"))


# --- Hashing core -----------------------------------------------------------


def hash_file(path: Path) -> str:
    """SHA-256 of raw file bytes."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def build_manifest(
    root: Path, rel_paths: list[str]
) -> tuple[bytes, list[tuple[str, str]]]:
    """
    Build a manifest: `<sha256>  <path>\\n` lines per file, LF endings.
    Returns (manifest_bytes, [(hash, path), ...]).
    """
    entries: list[tuple[str, str]] = []
    for rel in rel_paths:
        full = root / rel
        # is_symlink() check first — symlinks may report exists() based on the
        # target's existence, which is misleading for our purposes.
        if full.is_symlink():
            # Hash the link target string, not the target's content.
            # Cross-platform: do not resolve the link.
            target = os.readlink(full)
            h = hashlib.sha256(target.encode("utf-8")).hexdigest()
        elif full.is_file():
            h = hash_file(full)
        else:
            # Path doesn't exist (race?) or is a directory; skip.
            continue
        entries.append((h, rel))

    # Build manifest bytes: LF endings, two-space sha256sum-compatible separator.
    lines = [f"{h}  {p}\n".encode("utf-8") for h, p in entries]
    manifest = b"".join(lines)
    return manifest, entries


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


# --- Config loading ---------------------------------------------------------


def load_config(path: Path | None) -> dict:
    if path is None:
        return DEFAULT_CONFIG
    text = path.read_text(encoding="utf-8")
    if path.suffix in (".yaml", ".yml"):
        if yaml is None:
            print(
                "ERROR: PyYAML not installed; use a .json config or `pip install pyyaml`",
                file=sys.stderr,
            )
            sys.exit(2)
        return yaml.safe_load(text)
    if path.suffix == ".json":
        return json.loads(text)
    print(f"ERROR: unknown config format: {path.suffix}", file=sys.stderr)
    sys.exit(2)


# --- Main -------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Deterministic SHA-256 manifest hashing for audits.",
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path.cwd(),
        help="Repo root (default: cwd)",
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=None,
        help="Config file (YAML or JSON); uses DEFAULT_CONFIG if omitted",
    )
    parser.add_argument(
        "--manifests-dir",
        type=Path,
        default=None,
        help="If set, write per-component manifest files to this dir for review",
    )
    parser.add_argument(
        "--format",
        choices=["yaml", "json"],
        default="yaml",
        help="Output format for the hash block (default: yaml)",
    )
    args = parser.parse_args()

    cfg = load_config(args.config)
    components = cfg.get("components", {})
    exclude_global = cfg.get("exclude_global", [])

    root = args.root.resolve()
    if not root.is_dir():
        print(f"ERROR: --root {root} is not a directory", file=sys.stderr)
        return 2

    results: dict[str, str] = {}
    all_manifests: list[bytes] = []

    for comp_name, comp_cfg in components.items():
        include = comp_cfg.get("include", [])
        exclude = comp_cfg.get("exclude", [])
        rel_paths = collect_paths(root, include, exclude, exclude_global)
        manifest, entries = build_manifest(root, rel_paths)
        sub_hash = sha256_bytes(manifest)
        results[f"{comp_name}_sha256"] = sub_hash
        all_manifests.append(manifest)

        if args.manifests_dir:
            args.manifests_dir.mkdir(parents=True, exist_ok=True)
            out = args.manifests_dir / f"{comp_name}.manifest"
            out.write_bytes(manifest)
            print(f"# wrote {out} ({len(entries)} files)", file=sys.stderr)

    # Overall manifest = concatenation of sub-manifests in component-order from config.
    overall = b"".join(all_manifests)
    results["manifest_sha256"] = sha256_bytes(overall)

    if args.format == "yaml":
        # Paste-ready audit front-matter block.
        print(f'manifest_sha256: "{results["manifest_sha256"]}"')
        for key, val in results.items():
            if key == "manifest_sha256":
                continue
            print(f'{key}: "{val}"')
    else:
        print(json.dumps(results, indent=2, sort_keys=True))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
