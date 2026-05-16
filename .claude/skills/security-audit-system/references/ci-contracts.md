# CI/CD Gate Contracts (Platform-Agnostic)

The verification gate is specified as a **contract**, not as platform-specific YAML. Any CI platform that can run a script with a non-zero exit status to fail a check can implement it. The contract is the universal part; the YAML is the local part.

---

## PR Gate Contract

```
Name:           Audit Verification
Trigger:        on pull-request to default branch
Preconditions:  working tree checked out at PR head SHA
Inputs:         repository contents
Checks (all must pass):
  1. The project version was bumped relative to default branch
     (or this is a non-release PR, in which case the gate may be advisory only)
  2. .security/audits/<current-version>.md exists
  3. Audit front matter is well-formed and complete for the declared tier
  4. audit_tier matches the tier declared in the claims document
  5. Recomputed hashes match the audit's recorded hashes
  6. Every cited exception ID exists in the registry
  7. No cited exception has expires_at <= now (T2+)
  8. Sign-off section is filled in (no placeholder)
  9. status is approved or conditional
  10. SBOM file exists and matches sbom_ref hash (T2+)
Failure mode:   block merge; PR cannot be merged until checks pass
```

The verification script encapsulates all of this. The CI configuration just invokes it.

---

## Release Pipeline Contract (T2+)

```
Name:           Build and Release
Trigger:        on push or tag to default branch
Preconditions:  PR gate has passed; audit is approved
Inputs:         release commit SHA
Outputs:
  1. Build artifact(s)
  2. Signed in-toto Statement covering the artifact(s)
  3. SBOM for this release
  4. Published release with the above attached

Verification contract (for downstream consumers):
  1. Subject digest in attestation matches deployed artifact digest
  2. Signer identity matches expected (repo + workflow + branch + builder)
  3. Transparency-log entry exists and is valid (Sigstore) OR
     public key signature verifies (long-lived key mode)
Failure mode:   release artifacts not published if any step fails
```

The verification contract is what gets documented in the project's `SECURITY.md` §"Build Verification" so downstream consumers know how to check.

---

## Platform mapping (one-line summary each)

| Platform | Native primitives this contract maps to |
|---|---|
| GitHub Actions | `pull_request` workflow with required status checks; `actions/attest-build-provenance` for attestation |
| GitLab CI | `.gitlab-ci.yml` with `rules:` and protected branches; built-in SLSA L2 provenance via GitLab Runner |
| Jenkins | Declarative pipeline with `stage`/`when` blocks; Sigstore plugin or Cosign keyless via Jenkins OIDC |
| CircleCI | Workflows + filters + approval jobs; Cosign with CircleCI OIDC |
| Drone CI | `.drone.yml` with `when:` conditions; Cosign for signing |
| Tekton | `PipelineRun` with `WhenExpressions`; Tekton Chains for attestation |
| Azure DevOps | YAML pipeline with `condition:` and environment approvals; Sigstore or Notary signing |
| Buildkite / Woodpecker / Argo Workflows | Analogous |
| Self-hosted / air-gapped | Run private Sigstore (Fulcio + Rekor + TUF custom roots) or HSM-backed long-lived keys |

The **gate contract** is what gets specified in this repo's documentation; the **platform configuration** is created to fit the specific repository.

---

## Branch protection

Regardless of platform, the default branch should require:

| Setting | T1 | T2 | T3 |
|---|---|---|---|
| Pull requests for all changes | ● | ● | ● |
| One approving review (not the author) | ● | ● | – |
| Two strongly-authenticated reviewers | – | – | ● |
| All required status checks passing (incl. audit gate) | ● | ● | ● |
| Linear history or signed merge commits | – | ● | ● |
| Signed commits from approved signers | – | – | ● |

"Strongly-authenticated" at T3 means hardware-key or equivalent — not username/password, not SMS 2FA.

---

## Example: GitHub Actions implementation

This is illustrative. Adapt to the actual repo's language and tooling.

```yaml
# .github/workflows/audit-gate.yml
name: Audit Verification

on:
  pull_request:
    branches: [main]

jobs:
  verify-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # need history to find prior audit
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - name: Run audit verification
        run: |
          python .security/scripts/verify-audit.py
```

```yaml
# .github/workflows/release.yml  (T2+)
name: Build and Release

on:
  push:
    tags: ['v*']

permissions:
  id-token: write       # for Sigstore keyless signing
  attestations: write   # for attest-build-provenance
  contents: write       # for release creation

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      digest: ${{ steps.hash.outputs.digest }}
    steps:
      - uses: actions/checkout@v4
      - name: Build
        run: |
          python -m build
      - name: Compute digest
        id: hash
        run: |
          DIGEST=$(sha256sum dist/*.whl | awk '{print $1}')
          echo "digest=$DIGEST" >> $GITHUB_OUTPUT
      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/

  attest:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist/
      - uses: actions/attest-build-provenance@v1
        with:
          subject-path: 'dist/*'
      - name: Generate SBOM
        run: |
          syft dist/ -o cyclonedx-json > sbom.cdx.json
      - uses: softprops/action-gh-release@v2
        with:
          files: |
            dist/*
            sbom.cdx.json
```

This pattern: build → attest → release. The attestation step uses GitHub's hosted attestation service (SLSA L2). To reach SLSA L3, the attestation generator must be isolated from user-defined build steps; see `framework-mapping.md` §"SLSA".

---

## Troubleshooting

### CI gate passes locally but fails in CI (or vice versa)

Most common cause: line-ending normalization not consistent. Check `.gitattributes` is enforcing LF; run `git add --renormalize .` locally; commit the normalized result.

Second most common: Python/Node/etc version differs between CI and local. Pin the version in CI explicitly.

Third: locale-dependent sorting in the hashing script. Test with `LC_ALL=C` set.

### CI gate fails with `Exception <ID> expired on <date>`

The accepted-risk exception has passed its `expires_at`. Re-evaluate:

- If the risk is still acceptable: update `expires_at` and `approved_at`, get fresh approver signature, commit
- If it's not: fix the underlying issue, remove the citation from the audit, commit

Don't bypass the expiration check. The mechanism exists to force this re-evaluation.

### CI gate fails with `status is draft`

The audit's `status` field is still `draft`. Either the sign-off is incomplete, or the auditor forgot to update it. Verify the sign-off section is filled in, then set `status: approved` (or `conditional` if exceptions were used).

### CI gate fails with `audit_tier does not match claims document`

The tier in `.security/audits/<version>.md` front matter doesn't match the `audit_tier` in `SECURITY.md`. Either:
- The tier actually changed → follow tier graduation (`tier-matrix.md` §"Tier Graduation"); update the claims document and audit consistently in the same PR
- The tier didn't change → fix the discrepancy in whichever file is wrong

### Release pipeline fails to produce a valid attestation

Symptoms: `actions/attest-build-provenance` (or equivalent) succeeds but downstream verification fails.

- **Subject digest mismatch:** the attestation was generated for a different artifact than what was published. Common cause: the build step modifies the artifact after the digest is computed. Compute the digest *after* the final build step.
- **Signer identity mismatch:** the workflow ran in a context different from what consumers expect. Document the *exact* signer identity in `SECURITY.md` §"Build Verification" — repo URL + workflow filename + ref + builder.
- **Transparency log entry not found:** Sigstore's Rekor took longer than expected to index. Retry the verification after a few minutes. If consistently failing, check Sigstore service status.

---

## Air-gapped or confidential environments

Sigstore's public transparency log stores certificate identities publicly — incompatible with some confidentiality requirements. Alternatives:

- **Private Sigstore deployment.** Run Fulcio + Rekor + TUF custom roots on-prem. Same architecture, no public exposure.
- **Long-lived keys backed by an HSM.** Skip Sigstore entirely. Generate keys in HSM, sign attestations with HSM, distribute public key out-of-band. Loses keyless ergonomics; gains airgap compatibility.
- **GPG signing with a known public key.** Lowest-tech option. Sign attestations and SBOMs with GPG; publish the public key. Works in any environment.

For T3 air-gapped: document the choice in the project's threat model. Each option has different trust-root assumptions and consumers need to know.
