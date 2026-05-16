# Scaffolding Guide (Phases 0–8)

This reference walks through implementing the audit system in a new repository. Each phase has a tier-keyed checklist; skip steps that don't apply at the project's tier.

> **A note on per-repo implementation.** The skill specifies the *system*. The actual files (scripts, CI configs, templates) must be created to fit the specific repository's language, build tooling, CI platform, and conventions. Treat the examples below as patterns to adapt, not literal artifacts to copy.

---

## Directory layout (convention, not mandate)

All audit-workflow files live under `.security/` so the repo root stays clean. Only artifacts with external location requirements remain at the top level.

```
<repo root>
├── <ci config>/                      # Platform-specific; see ci-contracts.md
├── .security/                        # Audit workflow (everything in one place)
│   ├── audits/                       # Per-release audit history (append-only)
│   │   ├── README.md                 # Documents the audit system for this repo
│   │   ├── TEMPLATE.md               # Template every audit must follow
│   │   ├── exceptions.json           # T2+: structured exception registry
│   │   ├── KNOWN-ISSUES.md           # T1: lightweight exception list (alternative)
│   │   └── <version>.md              # Per-release audit document
│   └── scripts/                      # Audit tooling (any language)
│       ├── audit-hash.<ext>          # Computes the deterministic content hash
│       └── verify-audit.<ext>        # CI gate implementation
├── docs/
│   └── SECURITY.md                   # Public claims document, audited per-release
├── .well-known/security.txt          # T2+: RFC 9116 disclosure metadata (must be at root)
└── sbom/                             # T2+: SBOMs per release
    └── <version>.cdx.json            # or .spdx.json
```

POSIX paths shown; adjust for Windows. Any layout that places the required artifacts under version control and accessible to the CI gate works.

---

## Phase 0 — Determine the tier

**Required for all projects.** Without a tier, the rest of the system is unscoped.

1. Walk through the five scoping questions in `SKILL.md` Mode A Step A1 with the project's stakeholders.
2. Propose a tier; record the rationale.
3. If the AI skill is driving, the assistant asks the questions and proposes the tier (user can override).
4. Open a PR establishing `audit_tier`, `tier_rationale`, `tier_set_at`, and `tier_set_by` in the claims document.
5. Have someone other than the proposer review and merge.

**Output:** the tier is recorded, in version control, before any further phase.

---

## Phase 1 — Claims document

(T1+) Create the claims document. See `claims-document.md` for the interview prompts and template structure. Use `assets/TEMPLATE-security.md` as the starting skeleton.

The claims document is a **promise the code must keep**. Every claim must be verifiable using the vocabulary in `claims-document.md` §"Claim Verification Vocabulary," or explicitly marked `manual_review` with a documented procedure.

---

## Phase 2 — Directory structure

Create the directories the system uses. Adjust paths for the repo's conventions:

```bash
mkdir -p .security/audits .security/scripts docs
# T2+:
mkdir -p sbom .well-known
```

---

## Phase 3 — Core files

### 3a. `.security/audits/TEMPLATE.md`

Adapt the template from `assets/TEMPLATE-audit.md`. Customize:

- The **Scope** section for the project's actual scope
- The **Claims Verification** table to reference the actual claims in the project's `SECURITY.md`
- The **Methodology** for the project's tech stack
- The **Framework Mapping** table contents (T3) or omission (T0/T1)

### 3b. Exception registry

(T2+) Create `.security/audits/exceptions.json` from `assets/TEMPLATE-exceptions.json` with an empty `exceptions: []` array.
(T1) Create `.security/audits/KNOWN-ISSUES.md` instead — a plain prose list is enough.

### 3c. `.security/audits/README.md`

Customize `assets/TEMPLATE-audits-readme.md` to document the project's specific choices:

- Tier and rationale
- Hash mode (A or B; see `hashing.md`)
- Exception ID prefix (2–6 character project code)
- CI platform
- AI skill use (yes / no)
- How superseded audits are marked

### 3d. Hashing script

Adapt `.security/scripts/hash_manifest.py` (or implement in another language). What matters is the **contract**:

- Reads a configuration declaring component groups (sources, deps, claims, build)
- Walks each declared path recursively
- Computes per-file SHA-256 over raw bytes
- Builds a sorted manifest of `<sha256>  <path>` lines per component
- Computes the SHA-256 of each manifest (sub-hashes) and of the concatenated full manifest (overall hash)
- Honors an exclusion list (e.g., build output, vendored dependencies, large generated assets)
- Outputs hashes in a format pasteable into the audit's YAML front matter
- Cross-platform: enforces LF line endings, NFC paths, byte-sorted paths

The **configuration** is the *one* thing each repo must customize: which paths belong to which component group, and which paths to exclude. See `hashing.md` for normalization rules.

### 3e. Verification script

Adapt `.security/scripts/verify_audit.py`. What matters is the contract:

- Locate the audit document for the current release version
- Parse the YAML front matter (a minimal YAML subset is sufficient)
- Verify all required front-matter keys are present and non-empty for the declared tier
- Verify `audit_tier` matches the tier declared in the claims document
- Verify the version in front matter matches the project's declared version
- Verify all required H2 sections are present (set varies by tier)
- Recompute all hashes via the hashing script and compare to the audit's recorded hashes
- Load the exception registry; verify every cited exception ID exists and has `expires_at > now` (T2+)
- Verify the sign-off section is filled in (no placeholder text remaining)
- Verify `status` is `approved` or `conditional` (not `draft` or `blocked`)
- Verify SBOM reference resolves to a file whose hash matches the registered SBOM hash (T2+)
- Exit 0 on pass; exit non-zero with a structured error list on failure

The exit-code contract is what makes the script portable across CI platforms.

---

## Phase 4 — AI skill (if used)

If the project will use AI assistance for audits, install this skill in the AI platform's skill directory. For Claude Code:

- Project-scoped: `<repo>/.claude/skills/security-audit-system/`
- User-scoped: `~/.claude/skills/security-audit-system/`

The skill operates per the rules in `prompt-injection-defense.md`. Document in `.security/audits/README.md` that AI assistance is used and link to the skill location.

---

## Phase 5 — CI/CD wiring

Wire the verification script into the project's CI platform as a required check on PRs to the default branch. See `ci-contracts.md` for the gate contract.

(T2+) Also configure the release pipeline to produce signed build attestations on tagged releases.

---

## Phase 6 — `security.txt` (T2+)

Place a `security.txt` file at `/.well-known/security.txt` of any HTTP-accessible deployment, per RFC 9116. Use `assets/TEMPLATE-security.txt` as a starting point. Minimum fields:

```
Contact: mailto:security@example.org
Contact: https://example.org/security/report
Expires: <ISO 8601, one year out>
Preferred-Languages: en
Canonical: https://example.org/.well-known/security.txt
Policy: https://example.org/security/policy
```

OpenPGP cleartext-signing of the file is recommended.

---

## Phase 7 — Test the system (dry-run audit)

**Do not skip this.** A scaffolded system that has never been exercised end-to-end is unreliable.

1. Create a draft audit:
   - Copy `.security/audits/TEMPLATE.md` to `.security/audits/<current-version>.md`
   - Fill in front matter (version, date, auditor, tier)
   - Run the hashing script; paste the output into the front matter
2. Run the verification script locally; iterate until it passes
3. Fill in the sign-off line with name and timestamp (or a placeholder + note "dry run")
4. Re-run the verification script to confirm it still passes
5. Commit to a branch; confirm CI runs the same script and produces the same result

If CI passes but local fails (or vice versa), there's a cross-platform determinism bug — see `hashing.md` §"Cross-platform determinism." Fix before continuing.

---

## Phase 8 — First real audit

1. Bump the project version
2. Invoke the audit skill (if used) or follow the manual procedure in `audit-procedure.md`
3. Review the draft carefully; never accept AI output without review
4. Run the hashing script and paste hashes
5. Run the verification script locally
6. Commit and open a PR
7. Confirm the CI gate passes
8. After merge, confirm the release pipeline produces the expected attestation (T2+)

After this, the system is operational. Subsequent audits follow `audit-procedure.md`.

---

## Per-tier file checklist (quick reference)

**T0:**
- (optional) A one-paragraph `SECURITY.md` declaring no-production-audit status

**T1:** T0 plus —
- `SECURITY.md` (or `docs/SECURITY.md`) with reporting channel and testable claims
- `.security/audits/README.md`
- `.security/audits/TEMPLATE.md`
- `.security/audits/KNOWN-ISSUES.md`
- Hashing script (in `.security/scripts/`)
- Verification script (in `.security/scripts/`)
- CI gate configured per `ci-contracts.md` §"PR Gate Contract"
- Branch protection on default branch
- Dependency vulnerability scan in CI
- (if AI used) AI skill installed

**T2:** T1 plus —
- Structured `.security/audits/exceptions.json` replacing `KNOWN-ISSUES.md`
- SBOM generation per release
- Signed build attestation per release
- Release pipeline configured per `ci-contracts.md` §"Release Pipeline Contract"
- `.well-known/security.txt`
- Separation of duties enforced (author ≠ approver)
- Prompt-injection hardening mandatory if AI used

**T3:** T2 plus —
- Threat model document
- VEX statements for all upstream CVEs
- Reproducible builds (or documented justification)
- Framework mapping table in audit document
- Two strongly-authenticated reviewers on each change
- Independent annual review of the audit system itself
- Periodic re-attestation of exceptions on CVSS-tiered schedule
