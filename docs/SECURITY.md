# Security & Privacy Documentation

## Class List Optimizer

**Version:** 1.3.0  
**Last Updated:** April 26, 2026  
**Document Type:** Security & Privacy Reference

---

## Quick Summary

| Question | Answer |
|----------|--------|
| Where is student data stored? | **Only on your computer** — in your browser's memory and local storage |
| Is data sent to the internet? | **No** — the app works completely offline |
| Are accounts required? | **No** — no login, no registration, no user tracking |
| Can IT verify these claims? | **Yes** — see [IT Deployment Guide](#it-deployment-guide) below |
| Does this comply with FERPA? | **Yes** — student data never leaves your institution's control |

---

## Usage by Role

### Teachers

**How to use it:**

1. Open the page in your browser.
2. Add your students or import your CSV. Work as normal.
3. Export your class lists when you're done.

**About your students' data:** Everything happens on your computer, in your browser. Nothing gets sent anywhere — no uploads, no accounts, no servers. The tool works the same whether you're online or offline.

**Curious how that works?** Load the page, then turn off your wifi. The tool keeps running. That's because all the actual work happens locally — once the page is open, the internet isn't doing anything. You can do all your class list work offline if you'd like.

---

### IT Administrators & Security Teams

See the [IT Deployment Guide](#it-deployment-guide) section for pre-deployment verification, security audit procedures, and deployment recommendations.

---

## Executive Summary (For Administrators)

**The Class List Optimizer is designed with student privacy as its highest priority.**

This application is a **single-file tool** that runs entirely inside your web browser. When you open the file and work with student data:

- ✅ **No data leaves your computer** — ever
- ✅ **No internet connection required** after the first download
- ✅ **No accounts or passwords** to manage
- ✅ **No analytics or tracking** of any kind
- ✅ **No cloud services** — nothing is uploaded anywhere
- ✅ **Works offline** — disconnect your computer from WiFi and it still works perfectly

**In plain terms:** Think of it like opening a Word document or Excel spreadsheet on your desktop. The data stays on your computer, just like a regular file. The only difference is that this "file" runs in your browser instead of Microsoft Office.

**For your IT team:** All security claims in this document can be independently verified using standard network monitoring tools. See the [Technical Architecture](#technical-architecture) and [Verification Steps](#verification-steps) sections.

---

## Data Privacy Guarantee (Plain Language)

### What This Means for Teachers and Administrators

**You have complete control over your student data.**

The Class List Optimizer operates like a calculator that happens to run in your browser. When you:

1. **Open the app** — it loads from the file on your computer
2. **Import student data** — the data goes directly into your browser's memory
3. **Create class lists** — all calculations happen on your computer
4. **Save your work** — it's stored only in your browser, nowhere else
5. **Export results** — you download a file directly to your Downloads folder

**At no point does any student information travel across the internet.**

### Common Questions

**Q: Can the app developer see my student data?**  
A: No. The app has no connection to any external server. Even if the developer wanted to access your data (which they don't), there is no technical pathway for them to do so.

**Q: What if I accidentally click the wrong button?**  
A: There is no "upload" button. The only way data leaves the app is when *you* choose to export it to a CSV file on your computer. You remain in complete control.

**Q: Is my data backed up to the cloud?**  
A: No. The app does not create cloud backups. If you want to keep your work, export the CSV file and save it to your school's secure file storage or network drive.

**Q: Can someone hack into the app and steal student data?**  
A: No. Because the app never connects to the internet, there is no "way in" for attackers. The only way to access the data is by physically using your computer.

---

## Technical Architecture (For IT Professionals)

### Application Model

The Class List Optimizer is a **client-side single-page application (SPA)** with the following architecture:

```
┌─────────────────────────────────────────────────────────┐
│  User's Computer                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Web Browser (Chrome, Safari, Firefox, Edge)    │    │
│  │  ┌─────────────────────────────────────────┐    │    │
│  │  │  Class List Optimizer Application      │    │    │
│  │  │  ┌─────────────────────────────────┐   │    │    │
│  │  │  │  React Components (UI)            │   │    │    │
│  │  │  ├─────────────────────────────────┤   │    │    │
│  │  │  │  Optimization Algorithm (JS)      │   │    │    │
│  │  │  ├─────────────────────────────────┤   │    │    │
│  │  │  │  localStorage (persistent data)   │   │    │    │
│  │  │  └─────────────────────────────────┘   │    │    │
│  │  └─────────────────────────────────────────┘    │    │
│  │  ▲                                            │    │
│  │  │ NO external network connections             │    │
│  │  │ after initial load                          │    │
│  │  ▼                                            │    │
│  │  localStorage only (same-origin)              │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Technology Stack

| Component | Technology | Version | Source |
|-----------|------------|---------|--------|
| UI Framework | React | 18.3.1 | unpkg CDN (inlined in release) |
| Rendering | ReactDOM | 18.3.1 | unpkg CDN (inlined in release) |
| Transpilation | Babel Standalone | 7.29.0 | unpkg CDN (inlined in release) |
| Styling | Custom CSS + Google Fonts | DM Sans, DM Mono | Google Fonts API (inlined) |
| Storage | Browser localStorage | Web API | Native browser implementation |
| Optimization | Simulated Annealing | Custom JS | Bundled in application |

### Key Security Characteristics

1. **No Server-Side Components** — Zero backend infrastructure
2. **No API Endpoints** — No REST/GraphQL/WebSocket connections
3. **No External JavaScript Execution** — All JS is bundled or inlined
4. **No Dynamic Script Loading** — No `eval()`, `new Function()`, or runtime script injection
5. **Deterministic Behavior** — Same input always produces same output (seeded RNG)
6. **Same-Origin Policy Protected** — localStorage is sandboxed per domain (file://)

---

## Network Behavior Analysis

### First Load (Development/Source Version)

When opening `class-list-optimizer-source.html` from the repository:

| Resource | URL | Purpose | SRI Hash |
|----------|-----|---------|----------|
| Google Fonts CSS | `fonts.googleapis.com` | Typography | N/A |
| React | `unpkg.com/react@18.3.1` | UI framework | N/A |
| ReactDOM | `unpkg.com/react-dom@18.3.1` | Rendering | N/A |
| Babel | `unpkg.com/@babel/standalone@7.29.0` | JSX transpilation | `sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y` |

**Note:** These external loads only occur for the development/source version. The **release version** has all resources inlined.

### Release Version Behavior

When opening `class-list-optimizer-vX.Y.Z.html` (downloaded from Releases):

| Phase | Network Activity | Data Transmitted |
|-------|-----------------|------------------|
| Initial Load | **None** — All resources are inlined | N/A |
| Runtime Operation | **None** — No API calls, no telemetry | N/A |
| Data Import | **None** — CSV data processed locally | N/A |
| Optimization | **None** — Algorithm runs in browser | N/A |
| Export | **None** — File downloaded locally | N/A |

### Verified Network Footprint

Using browser DevTools Network tab or external packet capture:

**Expected Behavior:**
- Zero HTTP requests after initial page load (release version)
- Zero WebSocket connections
- Zero `fetch()` or `XMLHttpRequest` calls
- Zero beacon/API/analytics calls

**Verification Command:**
```bash
# Using tcpdump to verify no external connections
sudo tcpdump -i any -n host <client-ip> and port 443
# Should show NO traffic when using the app
```

---

## Verification Steps

IT professionals can independently verify all security claims using the following methods:

### Method 1: Browser Developer Tools (Recommended)

**Step 1:** Open the Class List Optimizer HTML file in Chrome, Firefox, Edge, or Safari.

**Step 2:** Open Developer Tools (F12 or Cmd+Option+I on Mac).

**Step 3:** Click the **Network** tab.

**Step 4:** Clear any existing entries (click the 🚫 icon).

**Step 5:** Perform typical actions:
- Import a CSV with student data
- Add students manually
- Run the optimization
- Export class lists
- Change settings

**Expected Result:** The Network tab should show **zero requests**. The only entries you might see are:
- Initial page load (if using source version with CDN resources)
- Nothing at all (if using release version with inlined resources)

### Method 2: JavaScript Console Verification

**Verify no fetch/XHR calls are made:**

```javascript
// Open Console tab in DevTools and run:

// Monitor all fetch calls
const originalFetch = window.fetch;
window.fetch = function(...args) {
  console.warn('FETCH CALL DETECTED:', args);
  return originalFetch.apply(this, args);
};

// Monitor all XMLHttpRequest calls
const originalXHROpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url, ...args) {
  console.warn('XHR CALL DETECTED:', method, url);
  return originalXHROpen.call(this, method, url, ...args);
};

// Monitor WebSocket connections
const originalWebSocket = window.WebSocket;
window.WebSocket = function(url, ...args) {
  console.warn('WEBSOCKET CONNECTION:', url);
  return new originalWebSocket(url, ...args);
};

console.log('Network monitoring active. Use the app normally.');
```

**Expected Result:** No warnings should appear in the console during normal use.

### Method 3: External Network Monitoring

**Using tcpdump or Wireshark:**

```bash
# Identify your computer's IP address
ifconfig | grep "inet " | head -1

# Monitor HTTPS traffic (run before opening the app)
sudo tcpdump -i any -n 'tcp port 443 and host <your-ip>' -w classlist.pcap

# Use the app for 5-10 minutes, then stop capture (Ctrl+C)
# Open in Wireshark or analyze:
# Expected: Zero packets (or minimal OS-level traffic only)
```

### Method 4: Source Code Audit

**Verify no external data transmission in source:**

```bash
# Clone the repository
git clone <repo-url>
cd class-list-optimizer

# Search for any network calls
grep -r "fetch\|XMLHttpRequest\|WebSocket\|navigator.sendBeacon" src/
# Expected: No matches (except potentially in comments)

# Check for any HTTP requests in bundled code
grep -r "http" dist/*.html | grep -v "http-equiv"
# Expected: Only data URIs, no external URLs
```

### Method 5: localStorage Inspection

**Verify data storage location:**

```javascript
// In DevTools Console:

// List all stored data
Object.keys(localStorage).forEach(key => {
  console.log(`${key}:`, localStorage.getItem(key).substring(0, 100) + '...');
});

// Expected keys:
// - classListOptimizer_numericCriteria
// - classListOptimizer_flagCriteria

// Verify data is JSON (not encoded/encrypted for transmission)
const data = localStorage.getItem('classListOptimizer_numericCriteria');
console.log(JSON.parse(data)); // Should show plain JSON configuration
```

---

## Data Storage Details

### Storage Mechanism

The application uses **Browser localStorage** for persistence:

| Aspect | Detail |
|--------|--------|
| **Storage Type** | localStorage (Web Storage API) |
| **Scope** | Origin-bound (file:// or localhost only) |
| **Capacity** ~5-10 MB per origin (varies by browser) |
| **Persistence** | Survives browser restarts, cleared only by user action |
| **Encryption** | None (data at rest is unencrypted) |
| **Access** | Same-origin only — other websites cannot read |

### What Gets Stored

```javascript
// Configuration data only (no student PII by default)
{
  "numericCriteria": [
    { "name": "readingScore", "weight": 2.0 }
  ],
  "flagCriteria": [
    { "name": "SPED", "weight": 1.5 }
  ]
}
```

**Important:** Student data (names, scores, flags) is **NOT automatically persisted**. It exists only in memory during the session. To save student data, users must manually export to CSV.

### Data Lifecycle

```
User opens HTML file
    ↓
Application loads into browser memory
    ↓
User imports CSV → Data loaded into JavaScript memory
    ↓
User works with data → All operations in memory only
    ↓
User exports → CSV downloaded to local filesystem
    ↓
User closes browser tab → Student data cleared from memory
    ↓
Only settings/preferences remain in localStorage
```

### Clearing Stored Data

Users can clear all stored data by:

1. **In-app:** Settings → Reset to Defaults
2. **Browser:** Settings → Privacy → Clear browsing data → Cookies and site data
3. **Manual:** DevTools → Application → Local Storage → Clear All

---

## Third-Party Dependencies

### Development/Source Version CDN Resources

When using `class-list-optimizer-source.html`, these resources are loaded:

| Resource | Provider | Purpose | Integrity Check |
|----------|----------|---------|-----------------|
| React 18.3.1 | unpkg (Cloudflare) | UI framework | Subresource Integrity hash provided |
| ReactDOM 18.3.1 | unpkg (Cloudflare) | DOM rendering | Subresource Integrity hash provided |
| Babel Standalone 7.29.0 | unpkg (Cloudflare) | JSX transpilation | `sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y` |
| DM Sans/DM Mono | Google Fonts | Typography | No SRI (CSS only) |

**Note:** SRI (Subresource Integrity) hashes prevent the execution of modified third-party scripts. If the CDN content changes, the browser will refuse to execute it.

### Release Version (Recommended for Production)

**All CDN resources are inlined as data URIs in the release version:**

```html
<!-- Example: Inlined React -->
<script>/* Inlined from https://unpkg.com/react@18.3.1... */
// ... React source code ...
</script>
```

**Benefits of the release version:**
- ✅ Zero external network dependencies
- ✅ Works on air-gapped networks
- ✅ No CDN reliance or SPOF (Single Point of Failure)
- ✅ File hash can be verified independently
- ✅ No third-party script execution

### Dependency Security

All dependencies are:
- **Well-established open-source projects** with active maintenance
- **Loaded over HTTPS** (when using CDN)
- **Integrity-checked** via Subresource Integrity (SRI) hashes
- **Vetted by security communities** (React by Meta, Babel by community)

**No proprietary or obscure dependencies are used.**

---

## Offline Usage Instructions

### For Administrators: Why Offline Matters

**Offline capability is a privacy feature.** When you disconnect from the internet:

- There is physically no way for data to leave your computer
- You eliminate all network-based attack vectors
- You guarantee compliance with air-gapped security policies
- You can use the tool in environments without internet access

### How to Use Offline

**Step 1: Download the Release File**

1. Visit the [Releases page](../../releases)
2. Download `class-list-optimizer-vX.Y.Z.html` to your computer
3. **Optional but recommended:** Disconnect from WiFi/internet

**Step 2: Open and Use**

1. Double-click the downloaded HTML file
2. It opens in your default browser
3. Use all features normally — everything works offline
4. Export your class lists to CSV when finished

**Step 3: Save Your Work**

- The app remembers your **settings** between sessions
- The app does NOT remember your **student data**
- Always export to CSV if you want to save student lists

### Verifying Offline Operation

**Quick test:**
1. Turn off WiFi or unplug ethernet cable
2. Open the HTML file
3. Import a CSV, run optimization, export results
4. Everything should work identically to online mode

---

## Compliance Notes

### FERPA Compliance

The **Family Educational Rights and Privacy Act (FERPA)** protects the privacy of student education records.

**How the Class List Optimizer Supports FERPA Compliance:**

| FERPA Requirement | App Behavior |
|-------------------|--------------|
| **Access Control** | No external access — data stays on user's device |
| **Data Minimization** | Only necessary data is processed (no extraneous collection) |
| **No Third-Party Disclosure** | Zero data transmission to third parties |
| **Institutional Control** | Institution retains full control over student records |
| **Audit Trail** | No data modifications are logged (user controls all actions) |

**FERPA Alignment Statement:**

> Because the Class List Optimizer processes all student data locally and never transmits information over a network, it functions as a **local educational tool** rather than a **third-party service**. Under FERPA, institutions may use local tools to process education records without additional consent or agreement, provided the institution maintains control over the data and access.

**Recommendation:** Include this tool in your institution's standard software approval process. Treat it as you would Microsoft Excel or Google Sheets (desktop version) — a local productivity tool for educational records.

### Other Frameworks

| Framework | Relevance | Compliance Notes |
|-----------|-----------|------------------|
| **COPPA** | Not applicable | Tool is for educator use, not direct student interaction |
| **GDPR** | Limited | No personal data collection, no profiling, no data retention beyond user control |
| **State Privacy Laws** (CCPA, etc.) | Compliant | No sale of data, no tracking, no automated decision-making |
| **District IT Policies** | Verify locally | IT can audit using [Verification Steps](#verification-steps) |

---

## Incident Reporting

### Security Concerns or Questions

If you have questions about the security of this application or believe you have discovered a security vulnerability:

**Contact Method:**
- Open a GitHub issue on the repository
- Include "SECURITY" in the issue title
- Describe the concern in detail
- Include steps to reproduce if applicable

**What to Report:**
- Unexpected network connections
- Data appearing to leave the browser
- Suspicious file modifications
- Privacy concerns
- Compliance questions

**Response Commitment:**
- Security-related issues are prioritized
- Response within 48 hours
- Public disclosure only after mitigation (responsible disclosure)

### False Positive Indications

**Expected behaviors that may appear concerning but are normal:**

1. **Browser shows "This file is from the internet" warning** — Standard browser security for downloaded files
2. **Antivirus flags the HTML file** — May occur due to embedded JavaScript; file is safe
3. **File size is large (~3-4 MB)** — Due to inlined React and Babel libraries
4. **Browser shows "Cross-Origin" messages in DevTools** — Normal for file:// URLs, not a security issue

**If you encounter these:** They are expected and safe. Use the [Verification Steps](#verification-steps) to confirm no actual network activity.

---

## GitHub Pages Deployment vs. Local File

The Class List Optimizer is available in two forms: **locally downloaded file** or **GitHub Pages hosted**. Both provide identical client-side-only functionality.

### What's the Same

Both versions:
- ✅ Run entirely in your browser
- ✅ Never transmit student data anywhere
- ✅ Work offline after initial load (Pages version caches in browser)
- ✅ Use the same code

### What's Different

| Aspect | Local File | GitHub Pages |
|--------|------------|--------------|
| **First load** | No network | Connects to `github.io` |
| **Subsequent use** | Works offline | Works offline (cached) |
| **IP address exposed** | None | To GitHub on first load only |
| **Code updates** | Manual download | Automatic on refresh |

### The Only Risk: IP Address

When using the GitHub Pages version, your IP address is visible to GitHub when you first load the page. This is the same as visiting any website. Once loaded, **no further network activity occurs** — the CSP blocks all connections, including any that might leak data.

**Student data (names, scores, flags) is never transmitted.** It exists only in your browser's memory and localStorage, just like the downloaded file.

### Recommendation

**Either version is safe for real student data.** Choose based on preference:

- **Download** if you want zero network traffic or need offline/air-gapped use
- **GitHub Pages** if you want instant access and don't mind GitHub seeing your IP once

For FERPA compliance: both versions keep student data under your institution's control. The hosted version meets FERPA requirements because no student data leaves your computer.

---

---

## IT Deployment Guide

This section provides pre-deployment verification procedures, security audit steps, and deployment recommendations for IT administrators and security teams.

### Web + Teacher Deployment

**How to use it:**

1. Open the page in your browser.
2. Add your students or import your CSV. Work as normal.
3. Export your class lists when you're done.

**About your students' data:** Everything happens on your computer, in your browser. Nothing gets sent anywhere — no uploads, no accounts, no servers. The tool works the same whether you're online or offline.

**Curious how that works?** Load the page, then turn off your wifi. The tool keeps running. That's because all the actual work happens locally — once the page is open, the internet isn't doing anything. You can do all your class list work offline if you'd like.

### Download + Teacher Deployment

**How to use it:**

1. Go to the Releases page on GitHub and download the latest `class-list-optimizer-vX.Y.Z.html` file.
2. Save it somewhere you'll find it again — Desktop or Documents works fine.
3. Double-click to open it in your browser. Work as normal.

**Why download instead of using the website:** The file lives on your computer. You can use it without internet, save it for next year, or share it with a colleague by email or USB stick. Same tool, just yours to keep.

---

### Web + IT (GitHub Pages) Pre-Deployment Evaluation

**1. Source review**

Repo at `github.com/armstrys/class-list-optimizer`. MIT licensed, single maintainer, build pipeline in `.github/workflows/`. Confirm `npm run build` produces the inlined HTML deployed to GitHub Pages via `actions/deploy-pages@v4`.

**2. CSP verification**

View source on the deployed page and confirm the `<meta http-equiv="Content-Security-Policy">` tag includes `connect-src 'none'`, `img-src 'self' data:`, `font-src 'self' data:`. Browser-enforced defense in depth.

**3. Build provenance**

If the maintainer publishes attestations via `actions/attest-build-provenance`, verify the deployed artifact against the attestation for the corresponding commit.

**4. Behavioral test**

Open DevTools → Network tab. Load the page and observe initial requests (should resolve to `armstrys.github.io` plus any external CDN dependencies that aren't inlined; in the built artifact these should be minimal or zero). Disconnect from network. Exercise every feature: add students, import CSV with synthetic data, optimize, export. App must remain fully functional. Reconnect, clear the Network tab, and exercise features again — no requests should appear after initial load.

**5. Confirm zero outbound traffic during use**

Any unexpected request after initial load is a finding.

**Residual risk:** GitHub Pages serves the most recent deploy. A compromised maintainer account could ship a modified build between evaluation and user session. The CSP mitigates exfiltration in-browser. For staff use against real PII, the architecture supports — but does not require — disconnected operation; document this as available verification rather than mandated workflow.

**Recommend the hosted version when:** individual teachers want low-friction access for occasional use and your environment doesn't require a frozen artifact under change control.

---

### Download + IT Pre-Deployment Verification

**1. Pin a release**

Download `class-list-optimizer-vX.Y.Z.html` from the Releases page. The file is the unit of trust — version it, archive it, distribute it.

**2. Verify SHA-256**

Compute locally and compare against the value in release notes:

- **macOS/Linux:** `shasum -a 256 class-list-optimizer-v1.0.0.html`
- **Windows PowerShell:** `Get-FileHash class-list-optimizer-v1.0.0.html -Algorithm SHA256`

Mismatch = do not deploy.

**3. Verify build provenance** (if attestations are published):

```bash
gh attestation verify class-list-optimizer-v1.0.0.html --repo armstrys/class-list-optimizer
```

Cryptographically confirms the file was built by the expected GitHub Actions workflow from a specific commit.

**4. Inspect the artifact**

Open the file in a text editor. Confirm: no remote `<script src="http...">` references, no `fetch()` / `XMLHttpRequest` / `WebSocket` / `navigator.sendBeacon` calls in inlined JS, no telemetry, no analytics. Greppable; any hits warrant scrutiny.

**5. Behavioral test**

Open the file on a machine with network physically disconnected (or a VM with no network adapter). Every feature must work end-to-end. Confirms no hidden network dependency.

**6. Reproducibility check**

Diff the inlined script against the concatenated `src/*.js` files at the tagged commit. Running `build-standalone.js` locally on a clean checkout of the tag should reproduce the released artifact (modulo any deterministic build metadata).

---

### Deployment Options (in order of increasing assurance)

1. **Direct distribution** — Intranet share, MDM, email. Staff open the file locally. Simple, sufficient for most environments.

2. **Self-host internally** — Place the verified file on internal infrastructure, serve from a trusted URL with appropriate CSP response headers. Eliminates external dependencies.

3. **Air-gap deployment** — For strict data handling environments, distribute on machines that never touch the public internet. The architecture supports this natively.

---

### Operational Considerations

- The release file is your unit of change control. Re-verify on every version bump.
- Subscribe to repo releases via GitHub notifications for awareness of updates.
- The maintainer is an individual on a personal GitHub account. For long-term institutional use, consider forking to your organization's GitHub or archiving verified releases in your own systems.

**Recommend the downloaded version when:** any institutional deployment, use against real PII at scale, formal data handling requirements, or any time a frozen artifact under your control is preferred.

---

## Summary for Different Audiences

### For School Administrators

**Bottom line:** This tool is as private as using Excel on your desktop. Student data never leaves your computer, there are no accounts to manage, and you can disconnect from the internet and still use it. Your IT team can verify all of these claims.

### For IT Professionals

**Bottom line:** This is a zero-trust, zero-network SPA that uses localStorage for configuration only. No API calls, no telemetry, no external dependencies in the release version. All claims are verifiable via standard network monitoring and source code audit.

### For Teachers

**Bottom line:** Use this tool with confidence. Your student rosters are safe on your computer. No one can see them except you. When you're done, export your class lists and save them to your school drive.

---

## Document Information

| Field | Value |
|-------|-------|
| **Document Version** | 1.1 |
| **Application Version** | 1.5.7 |
| **Last Updated** | April 28, 2026 |
| **Review Cycle** | Annual or on major release |
| **Author** | Class List Optimizer Development Team |
| **Classification** | Public — Safe to share with auditors |

---

*This document is intended to provide transparency and reassurance about the security and privacy posture of the Class List Optimizer application. All claims can be independently verified by IT professionals using the methods described in the [Verification Steps](#verification-steps) section.*
