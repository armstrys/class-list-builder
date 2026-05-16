# Tier Matrix

Quick visual reference for which components are required at each tier. `●` = required, `○` = recommended, `–` = not applicable.

| Component | T0 | T1 | T2 | T3 |
|---|:---:|:---:|:---:|:---:|
| Claims document (`SECURITY.md` style) | ○ | ● | ● | ● |
| `security.txt` (RFC 9116) | – | ○ | ● | ● |
| Per-release audit document | – | ● | ● | ● |
| Hash pinning (audit → code) | – | ● | ● | ● |
| CI gate enforcing audit presence | – | ● | ● | ● |
| Audit template with required sections | – | ● | ● | ● |
| Dependency vulnerability scan | – | ● | ● | ● |
| Claims-verification table in audit | – | ○ | ● | ● |
| Branch protection / required review | – | ● | ● | ● |
| Exception registry (structured) | – | ○ | ● | ● |
| Exception expiration enforced in CI | – | – | ● | ● |
| Separation of duties (author ≠ approver) | – | ○ | ● | ● |
| Prompt-injection hardening (if AI used) | ○ | ● | ● | ● |
| SBOM per release | – | ○ | ● | ● |
| Signed build attestation | – | – | ● | ● |
| SLSA Build Level | L0 | L1 | L2 | L3 |
| VEX statements | – | – | ○ | ● |
| Reproducible builds | – | – | ○ | ● |
| Formal threat model document | – | – | ○ | ● |
| Framework mapping table (SOC 2 / SSDF) | – | – | ○ | ● |
| Independent annual review of audit system | – | – | – | ● |

If a component is marked `–` for the project's tier, skip the corresponding section entirely.

---

## Tier descriptions

### Tier 0 — Personal / Experimental

**Typical project:** single-developer tools, throwaway scripts, code that exists to learn or prototype.
**Data:** none, or only data the developer owns.
**Adversary:** none specific.
**Blast radius:** the developer's own machine.

**Honest answer: most T0 projects should not adopt this system at all.** If used, the lightweight subset is:

- A one-paragraph claims document stating "this is not audited for production use"
- A single manual review note per release (or no release process at all)
- No hash pinning, no CI gate, no exception registry, no SBOM, no attestations

Forcing structure where it isn't needed is how security frameworks get abandoned. Tell the user this directly.

### Tier 1 — Standard OSS / Internal Tools

**Typical project:** public OSS without sensitive-data handling; internal tools serving one team; libraries used by colleagues; hobby projects with real users.
**Data:** non-sensitive, or only data users explicitly provide locally.
**Adversary:** opportunistic only (drive-by attackers, dependency-confusion, typo-squatters).
**Blast radius:** limited to the project's direct users; a compromise is recoverable.

**Mandatory components:**
- Claims document with a reporting channel (`SECURITY.md` and/or `security.txt` per RFC 9116)
- Per-release audit document, hash-pinned to the release commit
- Lightweight CI gate: audit exists, hashes match, sign-off present
- Dependency vulnerability scan against OSV (default recommendation)
- Branch protection on the default branch; required PR review by someone other than the author

**Skipped:**
- Build provenance attestations
- SBOM generation
- Formal exception registry (a plain `KNOWN-ISSUES.md` suffices)
- Reproducible builds
- Separation-of-duties beyond "author ≠ reviewer"

### Tier 2 — Sensitive-Data or Widely-Depended-On

**Typical project:** apps handling user data; OSS libraries with significant downstream consumption; SaaS products; tools used by other organizations; commercial software.
**Data:** user PII, business data, authentication tokens, or anything covered by privacy regulation.
**Adversary:** motivated attackers; supply-chain threats; insider misuse risk.
**Blast radius:** multiple organizations or many individuals could be harmed by a compromise.

**Everything from Tier 1, plus mandatory:**
- Signed build attestations (in-toto Statements, SLSA Build Level 2 or equivalent)
- SBOM produced per release (CycloneDX or SPDX) and referenced by the audit
- Structured exception registry with expiration dates and named approvers
- Claims-verification table in the audit (each claim → pass/fail + evidence pointer)
- Separation of duties: the release approver is not the primary author of the release's changes
- Prompt-injection hardening (mandatory if AI assistance is used at any stage)

**Recommended but not required at T2:**
- Reproducible builds
- VEX statements for upstream CVEs (CycloneDX VEX or CSAF VEX)
- Formal threat model document

### Tier 3 — High-Stakes / Regulated / Safety-Critical

**Typical project:** federal supply chain; financial and health systems; critical infrastructure; cryptographic libraries; software whose failure could harm humans physically.
**Data:** regulated, classified, financially material, or safety-relevant.
**Adversary:** includes nation-state-level threats.
**Blast radius:** critical infrastructure, large populations, human safety, or systemic risk.

**Everything from Tier 2, plus mandatory:**
- SLSA Build Level 3 or equivalent (isolated builder, unforgeable provenance, signing keys inaccessible to user-defined build steps)
- VEX statements emitted for every upstream CVE the project is exposed to
- Reproducible builds where technically achievable, with documented justification where not
- Formal threat model document, refreshed at least annually
- Explicit framework mapping table (SOC 2 CC8.1, NIST SSDF, applicable industry regulation) included in the audit document
- Periodic re-attestation of exceptions on a CVSS-tiered schedule (see `exception-registry.md`)
- Independent third-party review of the audit system itself at least annually

---

## Recording the tier

The chosen tier goes in the **claims document** and in the **audit's front matter** (`audit_tier: 1`). It is *part of the audited state* — changing tiers is a deliberate, reviewable action, not something that drifts.

```yaml
audit_tier: 2          # 0 | 1 | 2 | 3
tier_rationale: >
  This project handles user-provided documents containing
  business-sensitive information. Compromise could affect
  multiple organizations. Tier 2 is appropriate.
tier_set_at: "<ISO 8601 UTC>"
tier_set_by: "<approver name or role>"
```

The verification script enforces that the tier in the audit matches the tier in the claims document. Drift between them fails the gate.

---

## Tier graduation

Projects move between tiers as their context changes. A normal trajectory: Tier 0 (personal experiment) → Tier 1 (small users appear) → Tier 2 (handling user data). The tier transition itself is a reviewable change.

### Procedure

1. Open a PR titled "Promote to Tier N"
2. Update `audit_tier` in the claims document (and `tier_rationale`, `tier_set_at`, `tier_set_by`)
3. Add the mandatory components for the new tier in the same PR (or in a tracked sequence of follow-up PRs)
4. Have an approver who is *not* the proposer sign off

The first audit at the new tier exercises the new components end-to-end. Don't promote and ship in the same release without a dry run.

### Demotion

Demotion (e.g., T2 → T1) is allowed but rare. Reasons: discontinued data handling, deprecated to internal-only, project archive. Same PR procedure as promotion, with explicit `tier_rationale` documenting why posture is being reduced. Demotion does not retroactively change prior audits — they remain at the tier they were audited under.

---

## When the AI skill drives tiering

When the assistant first runs this skill on a new repository, it interviews the user with the five scoping questions, proposes a tier, and explains its reasoning. **The user can override.** When in doubt, propose the higher tier and let the user adjust down — adopting at a higher tier and discovering some components are overkill is recoverable; adopting at too low a tier and discovering it after a compromise is not.

The five scoping questions are restated in `SKILL.md` Mode A Step A1 — use them verbatim.
