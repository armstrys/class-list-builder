# Class List Optimizer

A web application that helps teachers and administrators automatically create balanced class lists based on student data.

![App Screenshot](docs/images/app-screenshot.png)

## What It Does

Class List Optimizer uses a smart algorithm to fairly distribute students into classrooms while balancing multiple factors:

- **Academic Performance** – evenly distribute reading and math scores
- **Intervention Needs** – balance students requiring 504 plans, IEPs, speech services, ELL support, etc.
- **Behavior Support** – ensure students needing behavioral accommodations are distributed thoughtfully
- **Gifted & Talented** – spread GT students across classes
- **Gender Balance** – maintain even boy/girl ratios

You can also manually adjust assignments and "lock" specific students to certain classes before running the optimizer.

---

## Privacy & Security

**Your data never leaves your computer.**

- Runs entirely in your browser – no internet connection required
- No data is uploaded to any server
- No accounts, logins, or tracking
- Works completely offline after downloading

---

## Download & Use

### Option 1: Download Release (Recommended)

1. Go to the [Releases](../../releases) page
2. Download the latest `class-list-optimizer-vX.Y.Z.html` file
3. **Double-click to open** in any modern web browser (Chrome, Safari, Firefox, Edge)
4. That's it – no installation required!

### Option 2: Build from Source

If you prefer to build it yourself:

```bash
# Clone the repository
git clone https://github.com/armstrys/class-list-optimizer.git
cd class-list-optimizer

# Build the standalone file
node build-standalone.js

# The output will be in dist/class-list-optimizer-vX.Y.Z.html
```

---

## Quick Start

1. **Import your data** – Upload a CSV with student information (or add manually)
2. **Set class count** – Specify how many classes you need
3. **Lock students** (optional) – Drag and drop to assign students who must be in specific classes
4. **Run optimizer** – Click "Re-Optimize" to automatically balance all classes
5. **Fine-tune** – Manually adjust any assignments as needed
6. **Export** – Download your final class lists as CSV

---

## CSV Import Format

Your CSV should have columns for:
- Student name
- Gender (M/F)
- Reading/Math scores (optional)
- Any flags/attributes (GT, SPED, 504, ELL, etc.)

See the app for a complete template.

---

## System Requirements

- **Any modern web browser** (Chrome, Safari, Firefox, Edge)
- **No internet connection needed** after download
- **No installation required**

---

## For Developers & Contributors

This project is built with vanilla HTML, CSS, and React (via Babel standalone). The standalone release bundles everything into a single HTML file.

### Project Structure

```
class-list-optimizer-source.html   # Source file with CDN dependencies
build-standalone.js                # Build script that inlines all resources
dist/                              # Output directory for releases
```

### Building Locally

```bash
node build-standalone.js
```

This fetches React, ReactDOM, Babel, and Google Fonts from CDNs and inlines them as data URIs.

### Contributing

1. Fork the repository
2. Make changes to `class-list-optimizer-source.html`
3. Test by opening the file in a browser
4. Submit a pull request

PR titles can include `#major` to trigger a major version bump; otherwise, minor versions are automatically incremented on merge to `main`.

---

## License

MIT License – feel free to use, modify, and distribute.

## Support

Found a bug or have a feature request? [Open an issue](../../issues) on GitHub.
