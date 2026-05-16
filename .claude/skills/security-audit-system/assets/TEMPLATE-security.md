# Security & Privacy

> The claims in this document are verified per-release by the audit
> system in `.security/audits/`. Any discrepancy between this file and the
> source code at audit time fails the release audit and blocks merge.

## Scope and Tier

This project is at **Tier <N>**.

<!--
audit_tier: <N>
tier_rationale: >
  <Brief rationale: what the software is, what data it handles, who
  the adversary is, blast radius of compromise. 2-4 sentences.>
tier_set_at: "<ISO 8601 UTC>"
tier_set_by: "<approver name or role>"
-->

## Reporting a Vulnerability

<!--
Private reporting channel. Pick the option appropriate to the project:

- GitHub Security Advisories (most common for GitHub-hosted OSS)
- GitLab confidential issues
- email + PGP (state the address and link the public key)
- HackerOne / Bugcrowd / Intigriti (for projects with bug-bounty programs)
- Internal ticketing (state how to access)

State expected response time. Example:

> Please report security vulnerabilities via [GitHub Security Advisories][1].
> We acknowledge reports within 2 business days and provide a status update
> within 7 days.
-->

## Quick Facts

| Question | Answer |
|----------|--------|
| Where is data stored? | <e.g., "Locally in ~/.config/myapp/; never transmitted"> |
| Is data transmitted to third parties? | <yes/no; if yes, what and where> |
| Are accounts required? | <yes/no; if yes, what auth method> |
| Regulated data handled? | <none / HIPAA / PCI-DSS / GDPR / etc.> |

## Data Handling

<!--
Plain-language explanation of what data the software touches and
where it goes. Should be readable by a non-technical user.

Example:
This application reads user-provided files from a local directory the
user specifies. It does not transmit file contents to any remote
service. Metadata about file types and processing duration is logged
to a local file at ~/.config/myapp/log.txt. No network connection is
made at runtime; the only network usage is at install time when fetching
pinned dependencies via the package manager.
-->

## Network Behavior (per phase)

| Phase | Behavior |
|-------|----------|
| Install / first run | <e.g., "Package manager fetches pinned dependencies. No other network activity."> |
| Runtime | <e.g., "No outbound network connections."> |
| Update | <e.g., "Update is via package manager; we do not implement auto-update."> |

## Verification Methods

### <Method 1 name>

<!--
Steps a third party can run; expected results.

Example:

### Verify no runtime network access

1. Install the package: `pip install myapp==1.2.3`
2. Run: `strace -f -e trace=network myapp process ./test-input.txt 2> trace.log`
3. Expected: trace.log shows no successful `connect()` calls to non-local addresses
-->

### <Method 2 name>

<!-- ... -->

## Supported Versions

| Version | Status | Security fixes until |
|---------|--------|----------------------|
| <X.Y>   | <Supported / EoL / Beta>  | <Date or "N/A"> |

## Dependencies

| Dependency | Source | Status |
|------------|--------|--------|
| <name>     | <registry/url>  | <Pinned by hash / Vetted / Audited / Mirror only> |

## Compliance (if applicable)

<!-- Omit this section entirely if no regulations apply. -->

| Regulation | How this project addresses it |
|------------|-------------------------------|
| <e.g., GDPR Art. 32> | <e.g., "All user data stored locally; no processing on our infrastructure"> |

## Deployment Options

<!--
How the software is installed and run; differences relevant to security.

Example:

This software is distributed in three forms:
- PyPI package (signed; verify with `cosign verify-attestation`)
- Docker image (signed via Sigstore keyless; verify with `cosign verify`)
- Standalone binary (Linux, macOS, Windows; signed; signatures in releases page)

The PyPI package and Docker image have continuous attestation; the
standalone binary is signed at release time only.
-->

## Build Verification (T2+)

<!--
T2+ only. How a consumer verifies the integrity of a downloaded artifact.

Example:

```bash
# Verify the attestation against a downloaded wheel
cosign verify-attestation \
  --certificate-identity-regexp \
    'https://github.com/<org>/<repo>/.github/workflows/release.yml@refs/tags/v.*' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  myapp-1.2.3-py3-none-any.whl
```

Expected output: subject digest matches the wheel's SHA-256, signer
identity matches our release workflow, transparency-log entry is
present and valid.
-->

## Disclosure Policy

<!--
Coordinated disclosure terms, embargo periods, safe-harbor language
for security researchers.

Example:

We follow coordinated disclosure with a 90-day embargo from initial
report to public disclosure, extensible by mutual agreement if a fix
is in active development.

Safe harbor: good-faith security research conducted in accordance with
this policy is welcomed. We commit not to pursue legal action against
researchers who:
  - Make a good-faith effort to avoid privacy violations and disruption
  - Do not exploit vulnerabilities beyond what's necessary to demonstrate
  - Do not publish details before the agreed disclosure date
-->

## Summary

| Audience | Bottom line |
|----------|-------------|
| End users | <One-liner: what's the security promise to a user> |
| IT admins | <One-liner: what an IT admin needs to know to deploy this> |
| Security/compliance | <One-liner: what a security team needs to know to approve> |
