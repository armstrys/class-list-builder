---
audit_version: "1.0"
schema: "<url to schema if published, otherwise omit>"
release: "<X.Y.Z>"
audit_tier: <0|1|2|3>
commit_sha: "<40 or 64 hex chars>"

# Hash pinning — pick ONE mode (A or B):
# Mode A — git tree hash binding:
tree_sha: "<git tree hash>"
# Mode B — standalone SHA-256 manifest:
# manifest_sha256: "<hash>"

# Sub-hashes (both modes):
sources_sha256: "<sha-256 of sources manifest>"
deps_sha256: "<sha-256 of dependencies manifest>"
claims_sha256: "<sha-256 of claims document>"
build_sha256: "<sha-256 of build inputs, optional>"

audited_at: "<ISO 8601 UTC>"
auditor: "<name or role>"
ai_assisted: <true|false>
ai_model: "<model identifier, if ai_assisted>"

# T2+ only:
approver: "<name or role; must differ from auditor>"
sbom_ref: "sbom/<X.Y.Z>.cdx.json"
attestation_ref: "<URI to signed in-toto Statement>"

# T3 only:
threat_model_ref: "docs/THREAT-MODEL.md"
threat_model_last_refreshed: "<ISO 8601>"

prior_audit: ".security/audits/<prior version>.md"
status: "draft"                  # draft | approved | conditional | blocked | superseded
exceptions_cited: []
# historical: true               # only on superseded / educational artifacts
# supersedes: ".security/audits/<original>.md"  # only on revisions (e.g. 1.4.2-r2)
---

# Audit — Release <X.Y.Z>

## Scope

<!--
What is and is not covered by this audit. Be explicit about exclusions.

Example:
This audit covers the source tree under src/, the dependency manifests
(pyproject.toml, poetry.lock), and the public claims document
(docs/SECURITY.md). It does NOT cover:
  - The tests/ directory (audited separately at release-test cycles)
  - Documentation under docs/ other than SECURITY.md
  - CI configurations in .github/workflows (audited separately at infra cycles)
-->

## Methodology

<!--
Tools used, AI involvement, human reviewers.

Example:
- Static review: manual + AI-assisted reading of all files in src/
- Dependency scan: OSV-Scanner v1.9.0, database snapshot 2026-05-15
- Hash computation: .security/scripts/audit-hash.py (Mode B, SHA-256 manifest)
- Verification: .security/scripts/verify-audit.py (exit 0 required for sign-off)
- AI model: <model id and version>
- Prompt-injection defenses applied per audit-system skill's
  references/prompt-injection-defense.md (all 7 layers)
- Human reviewer: <name> reviewed every AI-produced finding before sign-off
-->

## Claims Verification

<!--
T2+: required. T1: recommended.
One row per claim in the claims document.
-->

| Claim ID | Statement | Status | Evidence |
|---|---|---|---|
| `<PREFIX>-CLM-001` | <statement> | verified | <evidence: path:line, command output, or §reference> |
| `<PREFIX>-CLM-002` | <statement> | verified | <evidence> |
| `<PREFIX>-CLM-003` | <statement> | refuted | <evidence — blocks release> |
| `<PREFIX>-CLM-004` | <statement> | n/a | <reason> |
| `<PREFIX>-CLM-005` | <statement> | manual_review | reviewed by <name> on <ISO 8601>; procedure executed |

## Findings

<!--
Numbered findings using the project's PREFIX.
One H3 per finding. Use the structure below.
-->

### <PREFIX>-FND-0001 — <short title>

- **Severity:** <critical | high | medium | low | informational>
- **CVSS:** <v3.1 or v4.0 vector, if applicable>
- **Category:** <injection | auth | dependency | privacy | supply-chain | crypto | config | other>
- **Location:** `<path>:<line>` (or "system-wide")
- **Description:** What is wrong, in plain terms.
- **Impact:** What an attacker could do.
- **Remediation:** Specific fix.
- **Status:** <open | fixed-in-this-release | accepted (cite exception ID)>

### <PREFIX>-FND-0002 — <short title>

<!-- repeat as needed -->

## Dependency Audit

<!--
Summary of dependency vulnerability scan.

- Scanner: <name + version>
- Database snapshot: <ISO 8601>
- Lockfile audited: <path>
- SBOM audited (T2+): <path>

| Advisory | Severity | Component | Status |
|---|---|---|---|
| CVE-2026-12345 | high | foo-lib 1.2.3 | accepted via <PREFIX>-EXC-0007 |
| GHSA-xxxx-yyyy-zzzz | medium | bar-lib 4.5.6 | fixed by upgrade in this release |
-->

## Prompt Injection Defense Notes

<!--
T1+ required if AI assistance was used at any step.

- Sentinels scanned for: <list, or "per skill references/prompt-injection-defense.md">
- Files scanned: <count> across <list of paths/globs>
- Matches found: <count>

If matches found, quote them verbatim with file:line:

```
<verbatim quote>
```
Found at <path>:<line>. Recorded as <PREFIX>-FND-NNNN.

If no matches found, state explicitly:
"Scan performed; no sentinel matches detected."
-->

## Accepted Risks

<!--
List the exception IDs cited in this audit, with one-line rationale each.
Full details are in `.security/audits/exceptions.json`.

- <PREFIX>-EXC-0007 — Upstream CVE in foo-lib; not exploitable in our usage; expires 2026-08-15
- <PREFIX>-EXC-0012 — Cryptographic deprecation warning; pending v2.0 architectural change; expires 2026-11-01
-->

## Build Attestation

<!--
T2+ only. Pointer to the signed attestation.

- Attestation URI: <URI>
- Subject digest: <sha-256 of release artifact>
- Signer identity: <repo + workflow + branch + builder>
- Transparency log entry: <URL, if Sigstore>
- Verification command:
  ```
  cosign verify-attestation --certificate-identity ... <artifact>
  ```
-->

## SBOM Reference

<!--
T2+ only.

- SBOM path: sbom/<X.Y.Z>.cdx.json
- SBOM hash: <sha-256>
- Format: CycloneDX 1.5 (or SPDX 2.3)
- Generator: <tool + version>
- Includes transitive dependencies: yes
-->

## Framework Mapping

<!--
T3: required. T2: recommended.

| Framework | Requirement | Evidence |
|---|---|---|
| SLSA | L<N> | <pointer to §Build Attestation> |
| NIST SSDF | PW.7 | <pointer to §Sign-Off> |
| OpenSSF Scorecard | Pinned-Dependencies | <pointer to §Claims Verification §CLM-NNN> |
| SOC 2 CC8.1 | Approves | <pointer to §Sign-Off> |
| <applicable regulation> | <rule> | <evidence> |
-->

## Sign-Off

<!--
Auditor: <name> <<email>>
Audited at: <ISO 8601 UTC>

(T2+) Approver: <name> <<email>>
Approved at: <ISO 8601 UTC>

The auditor confirms that:
- Every claim in the claims document has been verified, refuted, marked n/a, or marked manual_review with documented procedure
- Every finding has been recorded with severity, location, impact, and remediation
- Every accepted risk cites a valid exception ID with non-expired approval
- The Prompt Injection Defense Notes section reflects the scan performed
- The verification script (`.security/scripts/verify-audit.py`) exits 0 against this audit
-->

Auditor: <REPLACE WITH NAME>
Audited at: <REPLACE WITH ISO 8601 UTC>

<!-- T2+: -->
Approver: <REPLACE WITH NAME>
Approved at: <REPLACE WITH ISO 8601 UTC>
