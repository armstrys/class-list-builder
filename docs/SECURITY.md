# Security & Privacy

**Version:** 1.6.0 | **Last Updated:** April 30, 2026

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
| Initial Load | **None** — all resources inlined | Loads React, Babel from unpkg CDN |
| Runtime | **Zero** network activity | **Zero** network activity |
| Data Import | Local file processing only | Local file processing only |
| Optimization | Browser-local computation | Browser-local computation |
| Export | Local download | Local download |

**Release version recommended** for production use with real student data.

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
**All dependencies are inlined** — zero external network dependencies:
- ✅ Works on air-gapped networks
- ✅ No CDN reliance
- ✅ File hash verifiable

### Source Version (Development)
Loads from unpkg CDN with Subresource Integrity (SRI) hashes:
- React 18.3.1
- ReactDOM 18.3.1  
- Babel Standalone 7.29.0

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
- Zero network traffic
- Works offline/air-gapped
- Fully under your control

### GitHub Pages (Convenient)
Visit `https://armstrys.github.io/class-list-builder/`:
- Same client-side-only functionality
- IP visible to GitHub on first load only
- CSP blocks all subsequent connections

**Both versions keep student data under your control.**

---

## IT Deployment Guide

### Pre-Deployment Verification

#### Option 1: Web (GitHub Pages)
1. **Source review:** `github.com/armstrys/class-list-builder` — MIT licensed
2. **CSP verification:** Confirm `connect-src 'none'` in deployed page source
3. **Behavioral test:** DevTools Network tab → verify zero requests after initial load
4. **Offline test:** Disconnect network, exercise all features

#### Option 2: Download (Recommended for PII)
1. **Pin a release:** Download from Releases page
2. **Verify SHA-256:** Compare against release notes
3. **Verify build provenance:** `gh attestation verify <file> --repo armstrys/class-list-builder`
4. **Inspect artifact:** Open in editor, confirm no remote scripts or network calls
5. **Behavioral test:** Run on air-gapped machine, verify all features work
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

Each release includes a cryptographically signed attestation proving the artifact was built by GitHub Actions from the source code.

**Requirements:**
- GitHub CLI (`gh`) installed
- Logged into GitHub: `gh auth login`

**Verification command:**
```bash
gh attestation verify class-list-builder-v1.6.0.html \
  --repo armstrys/class-list-builder
```

**Expected output:**
```
✓ Verification succeeded!

- The artifact was signed with a GitHub-generated OIDC token
- The artifact was built from the expected source code
```

This confirms the HTML file was built from the repository source and has not been tampered with.

---

## Security Reporting

Found a security concern?

1. Open a GitHub issue with "SECURITY" in the title
2. Describe the concern with reproduction steps
3. Issues are prioritized with 48-hour response commitment

---

## Summary

| Audience | Bottom Line |
|----------|-------------|
| **School Administrators** | As private as Excel on your desktop. IT-verifiable. |
| **IT Professionals** | Zero-trust, zero-network SPA. All claims verifiable. |
| **Teachers** | Your student data is safe on your computer. Export to save. |

---

*This document is public and safe to share with auditors. All claims can be independently verified using standard security tools.*
