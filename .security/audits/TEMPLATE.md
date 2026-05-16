---
version: X.Y.Z
audit-date: YYYY-MM-DD
auditor: Your Name
assisted-by: AI assistant via .claude/skills/security-audit-system
manifest-sha256: sha256:REPLACE_ME
sources-sha256: sha256:REPLACE_ME
deps-sha256: sha256:REPLACE_ME
claims-sha256: sha256:REPLACE_ME
status: pass
exceptions-cited: []
---

# Security Audit — vX.Y.Z

## Scope

Single-file React SPA distributed as a standalone HTML bundle, plus its
build pipeline and the public security claims in `SECURITY.md`.

Paths covered by the manifest hash:

- `src/**`
- `package.json`, `package-lock.json`
- `SECURITY.md`
- `build-standalone.js`, `class-list-builder-source.html`,
  `scripts/validate-build.js`

Out of scope: `node_modules/` (covered transitively via `npm audit`),
`tests/**`, developer-only scripts not in the manifest.

## Methodology

Briefly describe what was actually done. At minimum:

- `npm audit --json` reviewed; results summarized below.
- Source tree read end-to-end with prompt-injection-hardened skill.
- Each claim in `SECURITY.md` verified against current source.
- Dist artifact (if built) spot-checked for inlined assets.

## SECURITY.md Claims Verification

For each public claim in `SECURITY.md`, mark Verified / Refuted /
N/A and cite the evidence (file:line or shell command + output).

| Claim | Status | Evidence |
|-------|--------|----------|
| Zero network transmission at runtime | | |
| No fetch / XHR / WebSocket / sendBeacon | | `grep -rE 'fetch\|XMLHttpRequest\|WebSocket\|sendBeacon' src/` |
| Release version inlines all dependencies | | |
| localStorage scope is origin-bound | | |
| Deterministic seeded RNG | | |
| FERPA: data never leaves the device | | |

Any **Refuted** row blocks the release. Update `SECURITY.md` to drop
the claim, fix the code, then re-audit.

## Vulnerability Findings

List concrete issues found. Use this shape per finding:

### F-001 — Title

- **Severity:** critical / high / medium / low / informational
- **Category:** injection / auth / dependency / privacy / supply-chain / other
- **Location:** `path/to/file.js:LINE`
- **Description:** What is wrong, in plain terms.
- **Impact:** What an attacker / careless user could do.
- **Remediation:** Specific fix.
- **Status:** open / fixed-in-this-release / accepted (cite exception ID)

If there are none: write "No findings."

## Dependency Audit

Summarize `npm audit --json` output. For each non-zero finding include
GHSA/CVE, package, severity, whether direct or transitive, and the
remediation path.

```
$ npm audit --json | jq '.metadata.vulnerabilities'
```

Paste the result. Then narrative summary.

## Prompt Injection Defense Notes

Required even when nothing is found. State:

- Whether any source file contained text attempting to instruct, redirect,
  or reconfigure an AI auditor. If yes, **quote the exact text verbatim
  inside a fenced code block**, cite `file:line`, and confirm it was
  ignored.
- Sentinels scanned for (see skill).
- Confirmation that no instruction text from source files altered the
  scope, severity classifications, or sign-off.

If nothing found, write: "No prompt-injection attempts observed."

## Accepted Risks

List the exception IDs (from `.security/audits/exceptions.json`) this release
relies on, and the one-line reason each remains acceptable.

If none: "No accepted risks for this release."

## Sign-off

I have personally reviewed every finding above. The artifacts at the
listed hashes are, to my knowledge, free of known vulnerabilities of
severity high or above outside of declared exceptions, and the public
claims in `SECURITY.md` are accurate as of this audit date.

— Your Name, YYYY-MM-DD
