# Class List Optimizer

A web-based tool for optimizing class list distributions based on various student metrics.

## Files

- **Class List Optimizer.html** - Source version with external CDN dependencies (requires internet)
- **dist/class-list-optimizer-vX.Y.Z.html** - Standalone bundled version (works offline)

## Releases

Automated releases are created on every push to `main`. Each release includes a self-contained HTML file that works without an internet connection.

### Versioning

- Versions follow semantic versioning: `v{major}.{minor}.{patch}`
- Minor version is automatically bumped on each push to `main`
- To bump major version, include `#major` in your PR title

### Downloading Releases

1. Go to the [Releases](../../releases) page
2. Download the latest `class-list-optimizer-vX.Y.Z.html` file
3. Open it in any modern web browser - no installation needed!

## Development

### Building Standalone Version

```bash
# Install dependencies (none required, just Node.js)
# Build the standalone file
node build-standalone.js
```

This creates `dist/class-list-optimizer-v{version}.html` with all dependencies inlined.

## Usage

1. Open the HTML file in your browser
2. Add student data manually or import from CSV
3. Configure teacher/class settings
4. Run the optimizer to distribute students evenly across classes
5. Manually adjust and lock students as needed
6. Export the final class lists

## Features

- Automatic optimization using simulated annealing algorithm
- Balance across multiple metrics (academic scores, interventions, behavior, gender)
- Drag-and-drop manual adjustments
- Lock students to specific classes
- CSV import/export
- Works entirely offline (when using the standalone version)
