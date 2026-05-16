# Deterministic Content Hashing

**Purpose:** cryptographically bind the audit to an exact code snapshot. Two modes; pick one per repo and document the choice in `.security/audits/README.md`.

---

## Mode A — Git tree hash binding

Use the repository's existing tree hash. Verifiers run a single git command to confirm.

- **Pinning value:** the `tree` SHA of the release commit
- **Verification:**
  ```bash
  git rev-parse <commit>^{tree}
  ```
  Must match the audit's `tree_sha`.
- **Pros:** zero new format; works on any git repo; survives unrelated history rewrites
- **Cons:** binds the audit to git; still uses SHA-1 in most repos as of mid-2026 (SHA-256 git is rolling out slowly)

Simplest for git-based repos. Default choice unless the project has reason otherwise.

---

## Mode B — Standalone SHA-256 manifest

Build a deterministic manifest of `<sha256>  <path>` lines and hash that.

- **Pinning value:** the SHA-256 of the manifest
- **Manifest format:**
  - sorted by raw byte path
  - LF line endings
  - lowercase hex hashes
  - two-space separator (compatible with `sha256sum -c`)
- **Sub-manifests:** separate manifests per component (sources, deps, claims, build) so reviewers see which slice changed
- **Pros:** VCS-agnostic (works for Mercurial, Fossil, Pijul, or non-VCS trees); native SHA-256 today
- **Cons:** new format to maintain; requires per-repo component-group config

Required for non-git repos. Recommended for git repos that want SHA-256 today.

---

## Normalization rules (both modes)

| Concern | Rule |
|---|---|
| Path encoding | Unicode NFC, byte-sorted, forward slashes |
| Line endings | Enforce LF; hash bytes as-stored |
| File modes | Canonicalize to `0644` (files) / `0755` (executables), or exclude from hash |
| Symlinks | Hash the link target string; never resolve outside repo |
| Generated files | Excluded by default; explicit allowlist |
| Binary files | Hashed by raw bytes |
| Encoding | Raw bytes always; never decoded strings |
| Hash output | SHA-256 lowercase hex |

---

## Component groups (configurable)

```
sources:  source code paths
deps:     dependency manifests and lockfiles
claims:   the claims document
build:    build scripts and entry points (optional)
```

The configuration of which paths belong to which group is the **one** thing that must be customized per repo. The reference script in `.security/scripts/hash_manifest.py` provides defaults; the implementer adjusts.

Why split into sub-manifests? When the overall hash changes, the sub-hashes show *which slice* changed. A change in `claims_sha256` alone means the public security claims were edited — that's a meaningful signal distinct from a change in `sources_sha256`.

### Example configuration (Python project)

```yaml
# audit-hash-config.yaml
components:
  sources:
    include:
      - "src/**/*.py"
      - "myapp/**/*.py"
    exclude:
      - "**/__pycache__/**"
      - "**/*.pyc"
      - "**/test_*.py"          # tests audited separately or not at all
  deps:
    include:
      - "pyproject.toml"
      - "poetry.lock"
      - "requirements*.txt"
  claims:
    include:
      - "docs/SECURITY.md"
  build:
    include:
      - "Makefile"
      - ".github/workflows/release.yml"
exclude_global:
  - ".git/**"
  - "node_modules/**"
  - "dist/**"
  - "build/**"
  - "**/.DS_Store"
```

### Example configuration (Node.js project)

```yaml
components:
  sources:
    include:
      - "src/**/*.{js,ts,jsx,tsx}"
      - "lib/**/*.{js,ts}"
    exclude:
      - "**/*.test.{js,ts}"
      - "**/*.spec.{js,ts}"
  deps:
    include:
      - "package.json"
      - "package-lock.json"
      - "yarn.lock"
      - "pnpm-lock.yaml"
  claims:
    include:
      - "SECURITY.md"
  build:
    include:
      - "vite.config.ts"
      - "tsconfig.json"
exclude_global:
  - ".git/**"
  - "node_modules/**"
  - "dist/**"
  - "build/**"
  - "coverage/**"
```

---

## Cross-platform determinism

**A `.gitattributes` (or equivalent) enforcing LF line endings is required.** Without it, Windows checkouts produce different hashes than POSIX checkouts. Minimum `.gitattributes`:

```
* text=auto eol=lf
*.png binary
*.jpg binary
*.jpeg binary
*.gif binary
*.ico binary
*.pdf binary
*.zip binary
*.tar.gz binary
```

Other determinism gotchas to watch for:

1. **Locale-dependent sorting.** Sort by **raw bytes**, not by locale-aware comparison. Many languages' default `sort()` is locale-aware; specify byte-comparison explicitly.
2. **Filesystem case sensitivity.** On case-insensitive filesystems (macOS default, Windows), `Foo.py` and `foo.py` collide. Treat paths as case-sensitive in hashing; warn if duplicates collapse.
3. **Symlinks across platforms.** Windows symlinks behave differently from POSIX. The hashing script should hash the link **target string** (not follow it) for cross-platform determinism.
4. **File timestamps in archives.** If hashing an archive, normalize timestamps (`SOURCE_DATE_EPOCH`). For tarballs: GNU tar's `--mtime`, `--owner=0`, `--group=0`, `--numeric-owner`, `--sort=name`.
5. **Floating-point precision in generated files.** If any source file is auto-generated from a script that uses floating-point math, the generated bytes may vary across architectures. Exclude generated files or hash the generator's input + a fixed-seed snapshot of the output.

---

## When hashes don't match

The verification script reports a mismatch. Diagnostic checklist:

1. **Was code changed after the audit was written?** Most common cause. Re-run hashing, update audit, re-review findings to confirm they still apply, re-verify.
2. **Cross-platform issue?** Compare local hash to CI hash. If different, check line endings, locale, filesystem case sensitivity.
3. **A file in the exclude list slipped through?** Inspect the manifest file the hashing script produces; look for unexpected paths.
4. **Component-group misconfiguration?** A file moved between groups (e.g., a script moved from `.security/scripts/` to `src/`) would shift sub-hashes without changing the overall hash. Update the config if intentional; otherwise revert.
5. **`.gitattributes` wasn't applied retroactively?** Run `git add --renormalize .` after editing `.gitattributes` to re-normalize existing files.

If none of these explain it: stop. A hash mismatch the auditor can't explain is suspicious. Investigate before continuing.

---

## Hash mode in front matter

The audit's front matter declares which mode was used:

```yaml
# Mode A:
tree_sha: "abcdef1234..."          # git tree SHA
# (manifest_sha256 omitted)

# Mode B:
manifest_sha256: "abcdef1234..."   # SHA-256 of the manifest
# (tree_sha omitted)

# Both modes always include sub-hashes:
sources_sha256: "..."
deps_sha256: "..."
claims_sha256: "..."
build_sha256: "..."                # optional
```

The verification script knows which mode is in use by which fields are present. Don't include both `tree_sha` and `manifest_sha256` — pick one and stick with it across the project's history. Mixing modes silently is how integrity guarantees evaporate.
