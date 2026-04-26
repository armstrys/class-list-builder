# Contributing to Class List Optimizer

## Project Structure

```
class-list-optimizer-source.html   # Source file (edit this one)
build-standalone.js                # Inlines CDN resources into a self-contained file
dist/                              # Built releases
docs/images/                       # Screenshots and assets
```

The entire app is a single HTML file using vanilla HTML/CSS and React (loaded from CDN in development, inlined in releases). There are no build steps required to develop — just open `class-list-optimizer-source.html` in a browser.

## Making Changes

1. Fork the repository
2. Edit `class-list-optimizer-source.html`
3. Test by opening the file directly in a browser
4. Submit a pull request

PR titles can include `#major` to trigger a major version bump; otherwise minor versions are automatically incremented on merge to `main`.

## Building a Standalone Release

The standalone release bundles React, ReactDOM, Babel, and Google Fonts as inline data URIs so the file works with no internet connection.

```bash
node build-standalone.js
# Output: dist/class-list-optimizer-vX.Y.Z.html
```

## Optimization Algorithm

The core optimizer lives in the `optimize()` function in `class-list-optimizer-source.html`.

**Algorithm:** Greedy initialization + simulated annealing

1. **Greedy init** — Unlocked students are sorted by total score (descending) and assigned to classes using a score-aware snake draft: each student goes to the smallest class, with ties broken by giving the student to the class with the lowest current mean. This ensures high scorers are spread across classes from the start.

2. **Simulated annealing** — 100,000 iterations of random student swaps. Swaps that lower the cost are always accepted; swaps that raise the cost are accepted with decreasing probability as the temperature cools (`temp = 4.0`, `cooling = 0.99965`). This allows the optimizer to escape local optima early while converging to a stable solution.

**Cost function** — A weighted sum of normalized variances across all criteria:

- *Numeric scores*: `weight × Var(class_means) / Var(all_students)` — scale-agnostic, so a 5-point spread in reading contributes the same as a 5-point spread in math
- *Boolean flags*: `weight × Var(class_proportions)`
- *Gender*: `1.0 × Var(female_proportion per class)` (fixed weight)
- *Class size*: `3.0 × Var(class_sizes) / mean_size²` (fixed weight, intentionally high to enforce size balance)

**Locked students** are excluded from the swap pool entirely. Their contributions to class statistics are pre-computed before the annealing loop begins.

**Determinism** — Results are reproducible. The RNG seed is computed from a hash of student data, criteria config, locked assignments, and class count using FNV-1 + Mulberry32.
