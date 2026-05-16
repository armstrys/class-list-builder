# Claims Document Creation Guide

The claims document (`SECURITY.md` or `docs/SECURITY.md`) is the **public, audited promise** the project makes about its security posture. Every claim in it is verified per-release. A claim that drifts from actual code behavior fails the audit.

---

## Order of operations

**Tier first, then claims.** Without a tier, the claims document has no scope. See `tier-matrix.md` and use the five scoping questions from `SKILL.md` Mode A Step A1.

---

## Step 1 — Interview

Ask the five scoping questions plus these context questions:

- What does the software do at runtime, in plain language?
- Who are the audiences for this document? (End users, IT administrators, security teams, compliance officers, regulators)
- What regulations apply, if any? (GDPR, HIPAA, PCI-DSS, FedRAMP, CCPA, regional equivalents)
- How is the software deployed? (Published binary, container image, cloud service, on-prem, embedded firmware)
- What is the supported-versions / EoL policy?
- Is there a private channel for vulnerability reports? (GitHub Security Advisories, security@ + PGP, HackerOne)

The answers shape both the tier and the document structure.

---

## Step 2 — Determine tier

From the interview answers, propose a tier and explain. Wait for confirmation or override. When in doubt, propose the higher tier and let the user adjust down.

---

## Step 3 — Draft the document

Use the structure in `assets/TEMPLATE-security.md`. Omit sections that don't apply at the project's tier — e.g., a T1 project doesn't need a "Build Verification" section because it doesn't produce signed attestations.

The structure:

1. **Banner** — declares that claims are verified per-release by the audit system
2. **Scope and Tier** — what the software is, what data, who the adversary is, blast radius
3. **Reporting a Vulnerability** — private channel, expected response time
4. **Quick Facts** — table answering the most common questions (storage, transmission, accounts, regulated data)
5. **Data Handling** — plain-language explanation of what data is touched and where it goes
6. **Network Behavior (per phase)** — what happens at install, runtime, update
7. **Verification Methods** — steps a third party can run to confirm claims
8. **Supported Versions** — what's still receiving security fixes
9. **Dependencies** — vetted, pinned, notable
10. **Compliance (if applicable)** — regulation → how this project addresses it
11. **Deployment Options** — security-relevant differences across deployment modes
12. **Build Verification (T2+)** — how to verify the signed attestation
13. **Disclosure Policy** — coordinated disclosure terms, embargo, safe-harbor
14. **Summary** — one-liner per audience (end users / IT admins / security/compliance)

---

## Step 4 — Make every claim testable

For every claim in the draft, identify a verification mechanism using the vocabulary below.

If a claim cannot be verified by any of these methods, either rephrase it so it can, or remove it. Vague claims like "we follow industry best practices" are not permitted — they cannot be audited.

---

## Claim verification vocabulary

Every claim uses one of this small, fixed vocabulary. This makes the audit's verification step itself mechanical.

| Type | Meaning |
|---|---|
| `file_exists` | A specified path exists |
| `file_absent` | A specified path does not exist |
| `file_hash_matches` | A specified file matches a known SHA-256 |
| `string_present` | A regex matches at least once in a specified path |
| `string_absent` | A regex does not match anywhere in a specified path |
| `regex_match_count` | A regex matches exactly N times |
| `dependency_pinned` | A named dependency is pinned by hash or exact version |
| `dependency_absent` | A named dependency is not present (direct or transitive) |
| `script_exit_zero` | A specified script exits with status 0 |
| `manual_review` | Requires human judgment; documents the procedure |

Claims structured as `{id, statement, verification: {type, target, expected}}` can be processed mechanically by the verifier.

### Example claims

| Claim (statement) | Verification |
|---|---|
| No outbound network traffic at runtime | `string_absent` — regex `(requests\\.|urllib\\.|socket\\.|http\\.|fetch\\()` in `src/**/*.py` |
| No dynamic code execution | `string_absent` — regex `\\b(eval|exec|compile)\\(` in source |
| All dependencies pinned by hash | `dependency_pinned` — inspect `poetry.lock` for integrity hashes on every package |
| Cryptography only via stdlib | `dependency_absent` — `pycryptodome`, `cryptography` not in dependency tree |
| Storage limited to user settings dir | `manual_review` — read all call sites of `Path.open`, `open()`, `pathlib.Path.write_*`; confirm all writes scoped to `~/.config/myapp/` |
| Release artifacts signed | `script_exit_zero` — `.security/scripts/verify-release-attestation.sh <artifact>` |
| SECURITY.md present | `file_exists` — `docs/SECURITY.md` |
| LICENSE matches expected hash | `file_hash_matches` — `LICENSE` SHA-256 equals known-good |

### When to mark `manual_review`

Some claims genuinely require human judgment:

- "Cryptography uses appropriate algorithms" — needs review of *what's being protected* and *what threat model*, not just an algorithm name
- "Error messages don't leak sensitive information" — requires reading the messages
- "The build pipeline runs on isolated infrastructure" — requires checking external systems

For each `manual_review` claim, document **the procedure**:

```yaml
claim:
  id: "MYAPP-CLM-007"
  statement: "Error messages never include user credentials or session tokens"
  verification:
    type: manual_review
    procedure: |
      1. List all places that construct error messages: grep -r "raise.*Error\\|HTTPException" src/
      2. For each, inspect the message-string construction
      3. Confirm no f-string or .format() interpolates `password`, `token`, `session`, `key`, `secret`, or `auth` variables
      4. Confirm logged exceptions go through `sanitize_exception()` (defined in src/util/log.py)
    last_reviewed: "<ISO 8601>"
    reviewer: "<name>"
```

The procedure is what makes `manual_review` auditable rather than wishful.

---

## Step 5 — Human review

The claims document is a **promise the code must keep**. The maintainer reviews and corrects the draft before the first audit references it.

Common mistakes to catch in review:

- Claims about features that are partly implemented but not fully shipped
- Claims about future intentions worded as present facts
- Claims that are technically true but misleading (e.g., "no network access" when the installer downloads dependencies)
- Aspirational claims dressed as commitments

If a claim is true today but won't be next month, **don't make it a claim** — it'll fail the audit at the version it stops being true.

---

## Complement with `security.txt` (T2+)

Per RFC 9116, a machine-parseable disclosure file at `/.well-known/security.txt` of any HTTP-accessible deployment:

```
Contact: mailto:security@example.org
Contact: https://example.org/security/report
Expires: <ISO 8601, one year out>
Encryption: https://example.org/security/pgp.txt
Preferred-Languages: en
Canonical: https://example.org/.well-known/security.txt
Policy: https://example.org/security/policy
```

`Contact` and `Expires` are mandatory; the `Expires` date forces refresh discipline (one year out is typical). OpenPGP cleartext-signing of the file is recommended.

The `security.txt` file is separate from the claims document. The claims document is *what we promise*; `security.txt` is *how to reach us if you find we're not keeping it*.

Use `assets/TEMPLATE-security.txt` as a starting point.

---

## Claims and the audit

Each release's audit document includes a **Claims Verification table**:

| Claim ID | Status | Evidence |
|---|---|---|
| MYAPP-CLM-001 | verified | `string_absent` confirmed via `.security/scripts/check-no-network.sh` (exit 0); see appendix |
| MYAPP-CLM-002 | verified | dependency_pinned: 47/47 packages have integrity hashes in poetry.lock |
| MYAPP-CLM-003 | refuted | regex matched `eval(` at `src/plugins/loader.py:142` — **blocks release** |
| MYAPP-CLM-004 | n/a | claim added in next version |
| MYAPP-CLM-005 | manual_review | reviewed by Jane Doe on 2026-05-15; procedure executed; no leaks found |

`refuted` blocks the release. The path forward: fix the code or correct the claim. Don't accept refuted claims via the exception registry — exceptions are for *findings*, not *claims*. A refuted claim means the public promise is wrong, and that's not something to "accept."
