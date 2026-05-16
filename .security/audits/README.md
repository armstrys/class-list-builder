# Release Security Audits

Every release of this repo must ship with a per-version audit document at
`.security/audits/<version>.md`. CI gates merges to `main` on the audit's
presence, structural completeness, and freshness.

**Tier:** 2 (Sensitive data — FERPA-regulated student information)

## What CI checks (`.security/scripts/verify-audit.js`)

1. `.security/audits/<package.json version>.md` exists.
2. Front matter has `version`, `audit-date`, `auditor`, `manifest-sha256`,
   `sources-sha256`, `deps-sha256`, `claims-sha256`, `status`.
3. `status` is `pass` or `conditional-pass` (not `fail` or `draft`).
4. `version` in front matter matches `package.json`.
5. Required sections are present (see template).
6. `manifest-sha256` matches the current tree, recomputed by
   `.security/scripts/audit-hash.js`. **Any change to `src/`, `package*.json`,
   `docs/SECURITY.md`, or the build entrypoints requires a fresh audit.**
7. Any exception IDs cited in the audit exist in `.security/audits/exceptions.json`
   and have not expired.

## How to produce an audit

1. Bump `package.json` and `src/defaults.js` to the new version.
2. From the repo root, in Claude Code, run the security-audit-system skill:
   ```
   /skill security-audit-system
   ```
   The skill is at [.claude/skills/security-audit-system/SKILL.md](../../.claude/skills/security-audit-system/SKILL.md)
   and contains explicit hardening against prompt-injection from the
   codebase under audit. Read it before invoking.
3. The skill produces a draft at `.security/audits/<version>.md`. Review every
   finding manually. The auditor of record is **you**, not Claude — Claude
   assists, but the sign-off is human.
4. Run `node .security/scripts/audit-hash.js` and paste the hashes into the front
   matter (or let the skill do it as its final step).
5. Run `node .security/scripts/verify-audit.js` locally. Fix anything that fails.
6. Commit and open the release PR.

## Exceptions (`.security/audits/exceptions.json`)

Use sparingly. Format:

```json
{
  "exceptions": [
    {
      "id": "CLB-EXC-0001",
      "summary": "Brief one-line reason",
      "rationale": "Why this risk is acceptable in our threat model",
      "expires": "YYYY-MM-DD",
      "approvedBy": "name <email>",
      "approvedOn": "YYYY-MM-DD"
    }
  ]
}
```

The audit MUST cite each exception ID it relies on in the "Accepted Risks"
section. Expired exceptions fail CI.

## Historical / example audits

Audit files whose front matter sets `historical: true` are *not* tied to a
release that was signed off. They are kept as worked examples — typically
of a failing audit — so future auditors can see what real findings look
like in this repo's voice. They are ignored by CI (`verify-audit.js` only
loads `.security/audits/<package.json version>.md`).

When keeping a historical artifact:

1. Add `historical: true` to the front matter.
2. Add a blockquote banner at the very top of the body explaining the
   provenance — what code state it was run against, why it's retained,
   and that the hashes are frozen at the time of the audit (not
   recomputable).
3. Title the document `# Security Audit — vX.Y.Z (historical, …)` so a
   casual reader can't mistake it for a live audit.

Current historical artifacts:

- [`1.7.11.md`](1.7.11.md) — failing audit produced while the audit
  system itself was being added; surfaced F-001 / F-002 / F-003 in
  `docs/SECURITY.md`, all closed in v2.0.0.

## Files in this directory

- `README.md` — this file
- `TEMPLATE.md` — start every new audit by copying this
- `exceptions.json` — accepted-risk registry
- `<version>.md` — one per release, append-only after sign-off
  (or `historical: true` for retained examples)
