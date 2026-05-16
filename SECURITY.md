---
audit_tier: 2
tier_rationale: >
  This project is a browser-based educational tool that processes
  FERPA-regulated student data (names, test scores, behavior/medical
  flags) entirely locally. While data never leaves the device and
  the app has zero network attack surface, the sensitivity of the
  data and the educational context warrant Tier 2 rigor.
tier_set_at: "2026-05-16T00:00:00Z"
tier_set_by: "Ryan Armstrong"
---

# Security & Privacy

> The claims in this document are verified per-release by the audit
> system in [`.security/audits/`](.security/audits/README.md). Any discrepancy between this
> file and current source code fails the release audit and blocks merge.

---

## Quick Facts

| Question | Answer |
|----------|--------|
| Where is student data stored? | **Only on your computer** — browser memory and localStorage |
| Is data sent to the internet? | **No** — works completely offline |
| Are accounts required? | **No** — no login, no tracking |
| FERPA compliant? | **Yes** — data never leaves institutional control |

---

## How Your Data is Protected

The Class List Builder is a **single-file tool** that runs entirely in your browser:

- ✅ **Zero network transmission** — student data never leaves your device
- ✅ **Works offline** — disconnect WiFi and it keeps working
- ✅ **No accounts or cloud storage** — nothing to hack or breach
- ✅ **No analytics or tracking** — completely private

**In plain terms:** It's like opening an Excel file on your desktop. The data stays on your computer.

---

## For Different Audiences

### Teachers
Open the file, add your students, run the optimization, export results. Everything happens locally on your computer. Turn off WiFi if you want — it still works.

### IT Administrators
See the [IT Deployment Guide](#it-deployment-guide) for pre-deployment verification and security audit procedures.

### Administrators
This tool functions as a **local educational tool** under FERPA. It processes student data locally without transmission to third parties, requiring no additional consent or agreements.

---

## Technical Architecture

```
┌─────────────────────────────────────────┐
│  User's Computer                         │
│  ┌─────────────────────────────────┐    │
│  │  Web Browser                    │    │
│  │  ┌─────────────────────────┐   │    │
│  │  │  Class List Builder   │   │    │
│  │  │  ┌─────────────────┐    │   │    │
│  │  │  │ React UI        │    │   │    │
│  │  │  ├─────────────────┤    │   │    │
│  │  │  │ Optimization JS │    │   │    │
│  │  │  ├─────────────────┤    │   │    │
│  │  │  │ localStorage    │    │   │    │
│  │  │  └─────────────────┘    │   │    │
│  │  └─────────────────────────┘   │    │
│  │        ↑ NO external network   │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

**Key characteristics:**
- No server-side components
- No API endpoints
- No external JavaScript execution (release version)
- Same-origin policy protected
- Deterministic behavior (seeded RNG)

---

## Network Behavior

| Phase | Release Version | Source Version |
|-------|-----------------|----------------|
| Initial Load | **None** — all resources inlined | Loads React, ReactDOM, Babel, and ExcelJS from unpkg; fonts from Google. All with Subresource Integrity. |
| Runtime | **Zero** network activity. CSP `connect-src 'none'` enforces this. | **Zero** network activity. |
| Data Import | Local file processing only (CSV and XLSX) | Local file processing only (CSV and XLSX) |
| Optimization | Browser-local computation | Browser-local computation |
| Export | Local download | Local download |

**Release version recommended** for production use with real student data.

### Content Security Policy

Both the downloadable release artifact and the GitHub Pages deployment ship the
same CSP, applied by `build-standalone.js`:

```
default-src 'self' data: 'unsafe-inline';
script-src  'self' 'unsafe-inline' 'unsafe-eval';
style-src   'self' 'unsafe-inline' data:;
font-src    'self' data:;
img-src     'self' data:;
connect-src 'none';
base-uri    'none';
form-action 'none';
```

- `'unsafe-eval'` is required because Babel-standalone transpiles JSX in the
  browser via `eval`. This is a deliberate tradeoff of the single-file build.
- `connect-src 'none'` prevents `fetch` / `XMLHttpRequest` / `WebSocket` /
  `EventSource` from running at any point after page load.
- `script-src 'self'` — no external script origins are permitted. Every
  dependency (React, ReactDOM, Babel, ExcelJS, fonts) is bundled into the
  release artifact at build time.

---

## Verification Methods

IT teams can independently verify security claims:

### Browser DevTools (Easiest)
1. Open the app → Press F12 → Network tab
2. Clear entries (🚫 icon)
3. Import CSV, add students, run optimization, export
4. **Expected:** Zero network requests

### Source Code Audit
```bash
# Verify no network calls in source
grep -r "fetch\|XMLHttpRequest\|WebSocket\|sendBeacon" src/
# Expected: No matches

# Verify no external URLs in release
grep -r "http" dist/*.html | grep -v "http-equiv"
# Expected: Only data URIs
```

### Network Monitoring
```bash
# Monitor all HTTPS traffic during use
sudo tcpdump -i any -n 'tcp port 443' -w classlist.pcap
# Expected: Zero packets (or minimal OS-level only)
```

---

## Data Storage

### What Gets Stored

| Data Type | Location | Persistence |
|-----------|----------|-------------|
| **Settings/criteria** | localStorage | Survives browser restart |
| **Student data** | JavaScript memory only | Cleared on tab close |
| **Exported results** | Downloads folder | User-managed |

**Important:** Student data (names, scores, flags) is **not automatically persisted**. Export to CSV to save your work.

**If you use Save Project:** The resulting `.json` file contains all student data — it is yours to store and protect.

### Storage Details

| Aspect | Detail |
|--------|--------|
| **Type** | localStorage (Web Storage API) |
| **Scope** | Origin-bound (file:// or localhost) |
| **Capacity** | ~5-10 MB per origin |
| **Encryption** | None at rest |
| **Access** | Same-origin only |

### Clearing Data

- **In-app:** Settings → Reset to Defaults
- **Browser:** Clear browsing data → Cookies and site data
- **DevTools:** Application → Local Storage → Clear All

---

## Dependencies

### Release Version (Production)

| Dependency | Source | Status in Release |
|------------|--------|-------------------|
| React 18.3.1 | unpkg | **Inlined** |
| ReactDOM 18.3.1 | unpkg | **Inlined** |
| Babel Standalone 7.29.0 | unpkg | **Inlined** |
| ExcelJS 4.4.0 | unpkg | **Inlined** |
| DM Sans / DM Mono fonts | Google Fonts | **Inlined** (CSS + font files as data: URIs) |

- ✅ Works on air-gapped networks (every dependency is bundled)
- ✅ No CDN reliance at runtime
- ✅ File hash verifiable
- ✅ Subresource Integrity is pinned in the source HTML; the release build
  verifies the same hashes as it fetches and inlines each dependency

### Source Version (Development)

Loads from public CDNs with Subresource Integrity (SRI) on every script:
- React 18.3.1 (unpkg)
- ReactDOM 18.3.1 (unpkg)
- Babel Standalone 7.29.0 (unpkg)
- ExcelJS 4.4.0 (unpkg)
- DM Sans / DM Mono (Google Fonts CSS → `fonts.gstatic.com` font files)

The development CSP additionally permits `unpkg.com`, `fonts.googleapis.com`,
and `fonts.gstatic.com` in their respective directives. The release build
replaces it with the tighter policy shown above.

---

## Compliance

### FERPA

| Requirement | App Behavior |
|-------------|--------------|
| Access Control | No external access — data stays on device |
| Data Minimization | Only necessary data processed |
| No Third-Party Disclosure | Zero data transmission |
| Institutional Control | Institution retains full control |

### Other Frameworks

| Framework | Status |
|-----------|--------|
| **COPPA** | Not applicable — educator tool, not student-facing |
| **GDPR** | Compliant — no collection, profiling, or retention |
| **State Privacy Laws** | Compliant — no sale or tracking |

---

## Deployment Options

### Local File (Recommended)
Download `class-list-builder-vX.Y.Z.html` from Releases:
- Zero network traffic at runtime — every dependency is bundled
- Works offline / air-gapped (CSV and XLSX import included)
- Same release CSP as on GitHub Pages
- Fully under your control

### GitHub Pages (Convenient)
Visit `https://armstrys.github.io/class-list-builder/`:
- Same client-side-only functionality and same release CSP
- IP visible to GitHub on the initial document load only
- `connect-src 'none'` and `script-src 'self'` block all subsequent connections

**Both versions keep student data under your control.**

---

## IT Deployment Guide

### Pre-Deployment Verification

#### Option 1: Web (GitHub Pages)
1. **Source review:** `github.com/armstrys/class-list-builder` — MIT licensed
2. **CSP verification:** Confirm `connect-src 'none'` and `script-src 'self'` in deployed page source
3. **Behavioral test:** DevTools Network tab → import a CSV or XLSX, optimize, export. Verify zero requests after the initial document load.
4. **Offline test:** Disconnect network, exercise all features including XLSX import

#### Option 2: Download (Recommended for PII)
1. **Pin a release:** Download from Releases page
2. **Verify SHA-256:** Compare against release notes
3. **Verify build provenance:** `gh attestation verify <file> --repo armstrys/class-list-builder`
4. **Inspect artifact:** Open in editor; confirm zero remote `<script src="…">` or `<link href="https://…">` references
5. **Behavioral test:** Run on air-gapped machine, verify all features (including XLSX import) work
6. **Reproducibility:** Build locally, diff against release

### Deployment Assurance Levels

| Level | Method | Best For |
|-------|--------|----------|
| 1 | Direct distribution (email, MDM, intranet) | Most environments |
| 2 | Self-host internally | Eliminate external dependencies |
| 3 | Air-gap deployment | Strict data handling requirements |

### Operational Notes

- The release file is your unit of change control — re-verify on version bumps
- Subscribe to repo releases for update notifications
- Consider forking to your organization's GitHub for long-term use

---

### Build Verification

Each release includes a cryptographically signed attestation proving the artifact was built by GitHub Actions from the source code (SLSA Build Level 2).

**Requirements:**
- GitHub CLI (`gh`) installed
- Logged into GitHub: `gh auth login`

**Verification command:**
```bash
gh attestation verify class-list-builder-v2.0.0.html \
  --repo armstrys/class-list-builder
```

**Expected output:**
```
✓ Verification succeeded!

- The artifact was signed with a GitHub-generated OIDC token
- The artifact was built from the expected source code
```

This confirms the HTML file was built from the repository source and has not been tampered with.

### SBOM (Software Bill of Materials)

Each release includes a CycloneDX SBOM (`class-list-builder-vX.Y.Z.cdx.json`) that lists all dependencies and their versions. This enables:

- **Supply-chain transparency** — Know exactly what components are included
- **Vulnerability tracking** — Cross-reference against vulnerability databases
- **Compliance verification** — Verify license compatibility and provenance

The SBOM is generated automatically during the release build and attached as a release asset.

---

## Security Reporting

Found a security concern?

1. Open a GitHub issue with "SECURITY" in the title
2. Describe the concern with reproduction steps
3. Issues are reviewed on a best-effort basis

---

## Summary

| Audience | Bottom Line |
|----------|-------------|
| **School Administrators** | As private as Excel on your desktop. IT-verifiable. |
| **IT Professionals** | Zero-trust, zero-network SPA. All claims verifiable. |
| **Teachers** | Your student data is safe on your computer. Export to save. |

---

*This document is public and safe to share with auditors. All claims can be independently verified using standard security tools.*
