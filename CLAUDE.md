# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — static server on http://localhost:3000. Open `http://localhost:3000/class-list-optimizer-source.html`. **Required for development**: the source HTML loads JS via `<script type="text/babel" src="src/...">`, and Chrome blocks XHR between `file://` URLs (Firefox is permissive).
- `npm run build` (alias for `node build-standalone.js`) — produces `dist/class-list-optimizer-v<package.json version>.html`, a single self-contained HTML file with all sources, React/ReactDOM, Babel-standalone, and Google Font woff2 files inlined as data URIs.

There is no test suite, linter, or formatter configured. There is no bundler — JSX is transformed in the browser by Babel-standalone at load time.

## Architecture

### No-bundler module loading

Files in `src/` are not ES modules. Each file is loaded via a separate `<script type="text/babel">` tag and shares a single global scope. Load order matters and is fixed in [class-list-optimizer-source.html](class-list-optimizer-source.html):

```
defaults → optimizer → sample-data → csv → components/* → app
```

Practical consequences:
- Functions/constants defined in one file are top-level globals visible to later files. Don't add `import`/`export`.
- [src/defaults.js](src/defaults.js) destructures React hooks once (`const { useState, useEffect, useRef } = React;`) and the rest of the codebase relies on that being already in scope. `React` and `ReactDOM` are globals from the CDN scripts.
- A new component file must be added to the `<script>` list in `class-list-optimizer-source.html` *and* loaded after any file it depends on. The build script concatenates these in document order, so the same load order applies to the built artifact.

### Build process

[build-standalone.js](build-standalone.js) does three things in order:
1. Inlines `<link rel="stylesheet" href="src/...">` as `<style>` blocks.
2. Concatenates all `<script type="text/babel" src="src/...">` tags into a single inline `<script type="text/babel">` block injected before `</body>`, preserving the original document order.
3. Fetches the CDN URLs in `RESOURCES` and inlines them. For the Google Fonts CSS, it then fetches every `url(...)` woff2 file and rewrites them as `data:font/woff2;base64,...` URIs so the file works fully offline.

If you change a CDN URL in the source HTML, update the matching key in `RESOURCES` — the build replaces by exact URL match.

### Optimizer (the core of the app)

[src/optimizer.js](src/optimizer.js) implements the placement algorithm. There are two cost-function implementations that must stay in sync: a simple `computeCost()` (used for live UI cost display after drag/drop) and an incremental `costFromSums()` / `swapDelta()` / `applySwap()` trio inside `optimize()` (used during annealing for O(criteria) per-iteration updates). When adding or modifying a balance criterion, you must update **both** paths plus the per-class running-sum arrays initialized at the start of `optimize()`. Existing criteria currently maintained: numeric means (`classNumSums`), flag proportions (`classFlagCounts`), gender (`classFemale`), total flag count (`classTotalFlags`), total z-score (`classTotalScore`), and class size (`classSizes`).

Algorithm: score-aware snake-draft greedy init, then 100,000 simulated-annealing swaps (`temp = 4.0`, `cooling = 0.99965`). Locked students are excluded from the swap pool but pre-counted into the running sums.

**Determinism is a hard requirement**: the seed is computed in `computeSeed()` from a hash of student IDs+values, criteria config, locked assignments, and class count, then fed to a Mulberry32 PRNG. The same inputs must always produce the same output. Don't use `Math.random()` inside `optimize()` — only the seeded `rand()`.

### Configurable criteria

Numeric and flag criteria are user-editable at runtime via the Settings modal and persisted to `localStorage` under the keys in `STORAGE_KEYS` ([src/defaults.js](src/defaults.js)). Default lists live in `DEFAULT_NUMERIC_CRITERIA` / `DEFAULT_FLAG_CRITERIA`. The criteria arrays (each `{ key, label, short, weight }`) are passed as props to most components and to the optimizer — no component should hard-code criterion keys. Removing a criterion in Settings strips that key from every student object (handled in `App.handleSaveSettings` in [src/app.js](src/app.js)).

CSV import/export ([src/csv.js](src/csv.js)) generates headers dynamically from the active criteria, so the downloaded template always matches the current configuration.

### App shell

[src/app.js](src/app.js) is the React root. It manages the two top-level views (`'setup'` | `'optimize'`), student list, teacher list, criteria state, and renders [SetupPage](src/components/SetupPage.js) or [OptimizePage](src/components/OptimizePage.js). Teacher count = number of classes; the array order is the class index used throughout (`assignment[studentId] = classIndex`).

## Release workflow

- The version in `package.json` is the source of truth for release artifact filenames and git tags.
- [.github/workflows/pr-check.yml](.github/workflows/pr-check.yml) **requires** every PR to bump `package.json` version above `main`'s — PRs that don't bump fail CI.
- On merge to `main`, [.github/workflows/release.yml](.github/workflows/release.yml) runs the build, tags `v<version>`, and creates a GitHub Release with the built HTML attached.
- Per [CONTRIBUTING.md](CONTRIBUTING.md), PR titles can include `#major` to signal a major bump (the maintainer applies it; the workflow itself only checks that *some* bump happened).

## When making changes

- **Adding a React component**: create the file in `src/components/`, then add a `<script type="text/babel" src="src/components/Foo.js"></script>` line to [class-list-optimizer-source.html](class-list-optimizer-source.html) in the right load-order slot.
- **Adding a new balance criterion type** (beyond numeric/flag): update `computeCost`, the running-sum arrays, `costFromSums`, `swapDelta`, and `applySwap` in [src/optimizer.js](src/optimizer.js); the seed input in `computeSeed`; CSV header/parse/export in [src/csv.js](src/csv.js); the Settings modal; and likely `StatsStrip` and `ClassColumn`.
- **Changing optimizer weights or constants** (`temp`, `cooling`, `iters`, fixed weights for gender/size/total-flags/total-score) changes the output for *every* existing user. Treat as a behavioral change worth a version bump and a changelog note.
- Don't introduce a build step, package manager dependencies, or ES modules without discussion — the no-install, double-click-to-run distribution model is a primary product feature.
