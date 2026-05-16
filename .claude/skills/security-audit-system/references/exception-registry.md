# Exception Registry / Accepted Risk Log

**Minimum tier:** 2 for the structured registry. T1 can use a plain `KNOWN-ISSUES.md` prose list instead.

**Purpose:** centralized, auditable record of risks the project has decided to accept rather than fix, with expiration dates and named approvers. Expired exceptions fail CI, forcing periodic re-evaluation.

---

## Schema (JSON)

YAML and TOML are equivalent — pick the format that matches the project's conventions. JSON is the default.

```json
{
  "schema": "https://example.org/audit-exceptions/v1",
  "exceptions": [
    {
      "id": "<PREFIX>-EXC-0001",
      "title": "Short human description",
      "description": "What the risk is and what condition triggered the exception",
      "affected": ["<path or component or CVE id>"],
      "risk_level": "medium",
      "cvss": "<v3.1 vector if applicable>",
      "business_justification": "Why we are accepting this risk",
      "compensating_controls": ["Mitigations in place"],
      "approver": "<name or role>",
      "approved_at": "<ISO 8601 UTC>",
      "expires_at": "<ISO 8601 UTC>",
      "review_cadence": "P90D",
      "status": "active",
      "linked_finding": "<PREFIX>-FND-0007"
    }
  ]
}
```

### Required fields

- `id` — unique identifier; format `<PREFIX>-EXC-NNNN` where PREFIX is the project's 2–6 character code
- `title` — short human description
- `description` — what the risk is and what condition triggered the exception
- `affected` — list of paths, components, or CVE IDs
- `risk_level` — `critical | high | medium | low | informational`
- `approver` — name or role with authority to accept
- `approved_at` — ISO 8601 UTC timestamp
- `expires_at` — ISO 8601 UTC timestamp
- `status` — `active | expired | superseded | retired`

### Optional but recommended

- `cvss` — v3.1 or v4.0 vector
- `business_justification` — required for any T2+ exception (the auditable reason)
- `compensating_controls` — mitigations that make the residual risk acceptable
- `review_cadence` — ISO 8601 duration (e.g., `P90D`)
- `linked_finding` — the finding ID from the audit that surfaced this risk

---

## Expiration defaults (CVSS-tiered)

| Severity | CVSS range | Max expiration |
|---|---|---|
| Critical | ≥ 9.0 | 30 days |
| High | 7.0 – 8.9 | 60 days |
| Medium | 4.0 – 6.9 | 90 days |
| Low | < 4.0 | 180 days |

**Hard cap:** 365 days regardless of severity.

After expiry the CI gate **fails** until the exception is either re-approved (with new `approved_at` and `expires_at`) or the underlying issue is fixed and the citation removed.

The expiration mechanism is the system's defense against accepted-risk accumulation. Without it, a single accepted risk in 2026 becomes 200 forgotten accepted risks in 2031.

---

## Approval rules

- **The approver must not be the implementer** of the change that introduced the risk. Separation of duties applies even at T1 in spirit, and is enforced at T2+.
- **For T3 projects:** exceptions touching authentication, cryptography, secrets, data egress, or compliance-scoped components require security-team approval, not just engineering approval.
- **For OSS projects:** the registry should be publicly visible unless its contents would themselves leak vulnerability detail.

If an exception is approved and the approver later turns out to be inappropriate (e.g., conflict of interest discovered, role changed), the exception's `approver` is updated and `approved_at` is refreshed. The prior approval is preserved in git history.

---

## Status transitions

| From | To | Trigger |
|---|---|---|
| (new) | `active` | Created, approved, not expired |
| `active` | `expired` | `expires_at` passed without re-approval |
| `active` | `superseded` | Replaced by a new exception with revised scope/risk |
| `active` | `retired` | Underlying issue fixed; exception no longer cited |
| `expired` | `active` | Re-approved (new `approved_at`, new `expires_at`) |
| `expired` | `retired` | Issue fixed during re-evaluation |

`retired` and `superseded` exceptions stay in the registry as historical record. The CI gate only fails on `active` exceptions past `expires_at`.

---

## VEX emission

When an exception corresponds to an upstream CVE, the registry should emit a **VEX statement** (Vulnerability Exploitability eXchange) so downstream consumers can see the project's posture:

- `not_affected` — the vulnerability exists in a dependency but not exploitable in this product
- `affected` — vulnerable; mitigation in progress or accepted
- `fixed` — patched in this release
- `under_investigation`

**Format choices:**
- **CycloneDX VEX** — embedded in or alongside the CycloneDX SBOM
- **CSAF VEX 2.0** — OASIS standard; richer schema

At T3, VEX is **required for every CVE the project is exposed to**. At T2, it's recommended for material CVEs.

### Example VEX entry (CycloneDX)

```json
{
  "bom-ref": "CVE-2026-12345",
  "id": "CVE-2026-12345",
  "ratings": [...],
  "analysis": {
    "state": "not_affected",
    "justification": "code_not_reachable",
    "response": ["will_not_fix"],
    "detail": "The vulnerable function is in a code path not invoked by this project. See <PREFIX>-EXC-0042."
  }
}
```

The `<PREFIX>-EXC-NNNN` link makes the exception registry the source of truth; the VEX statement is the publishable view.

---

## Project prefix

`<PREFIX>` is a 2–6 character project code defined once in `.security/audits/README.md`. Examples: `ACME`, `WIDGET`, `MYAPP`.

The prefix is cosmetic; uniqueness within the registry is what matters. Don't change the prefix once exceptions exist — IDs are referenced by audit documents and changing the prefix orphans the references.

---

## When to add an exception vs. fix the underlying issue

Default: **fix it**. Exceptions are for risks that genuinely cannot or should not be fixed in the current cycle. Common legitimate reasons:

- Upstream dependency has the CVE; fix is pending upstream; we have a compensating control
- Architectural change required; cost exceeds risk; scheduled for next major version
- Risk is real but materially mitigated by other controls (network isolation, auth gates, rate limits)
- Vulnerability is in a code path not reachable in this product's configuration

Not legitimate reasons (these often appear as exceptions but shouldn't):

- "We don't have time" with no schedule
- "It's not exploitable in practice" with no evidence
- "We accept the risk" with no business justification
- "Customer asked us to" with no documented requirement

The exception's `business_justification` field exists to make the reasoning auditable. If you can't write a coherent business justification, you probably shouldn't add the exception.

---

## Re-attestation cadence (T3)

T3 projects re-attest exceptions on the CVSS schedule above **even if `expires_at` hasn't yet been reached**. Calendar reminders are external to this system; the audit system enforces the hard expiration.

Recommended workflow for T3:

1. Weekly: scan the registry for exceptions expiring in the next 14 days
2. For each: re-evaluate, refresh or retire, get fresh approval
3. Monthly: review *all* active exceptions; retire any that no longer apply
4. Annually: independent reviewer (not part of normal approval chain) reviews the registry as a whole

---

## Tier 1 alternative: `.security/audits/KNOWN-ISSUES.md`

At T1, a plain prose `KNOWN-ISSUES.md` is sufficient. Recommended structure:

```markdown
# Known Issues

This file lists accepted risks for this project. At Tier 2+, this would
be a structured `exceptions.json` with enforced expiration.

## EXC-0001 — Title

- **Affected:** path or component
- **Risk:** description
- **Why accepted:** business justification
- **Compensating controls:** what mitigates the residual risk
- **Approver:** name
- **Approved on:** YYYY-MM-DD
- **Review by:** YYYY-MM-DD
- **Linked finding:** FND-NNNN

(repeat per issue)
```

The CI gate at T1 checks that any cited exception ID exists in this file but doesn't enforce expiration. Re-evaluation is on the honor system at T1.

When the project graduates to T2, `.security/audits/KNOWN-ISSUES.md` is converted to `.security/audits/exceptions.json` and expiration enforcement turns on.
