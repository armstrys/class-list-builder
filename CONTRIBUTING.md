# Contributing to Class List Optimizer

## Ways to Contribute

**You don't need to be a technical person to contribute!** Here are ways anyone can help:

- **Report bugs or suggest features** — Noticed something not working right? Have an idea for improvement? [Open an issue](../../issues) on GitHub. Creating a GitHub account and submitting an issue is a valuable contribution, even if you've never written code.
- **Share feedback** — Tell us how you're using the tool and what would make it better for your school.
- **Spread the word** — Share this tool with other teachers and schools who might benefit.
- **Contribute code** — If you're comfortable with JavaScript and HTML, see the sections below for technical contributions.

## Project Structure

```
class-list-optimizer-source.html   # HTML shell — references files in src/
src/
  styles.css                       # All component styles
  defaults.js                      # Default criteria, color/key helpers, React destructure
  optimizer.js                     # computeCost + simulated-annealing optimize()
  sample-data.js                   # uid() and generateSampleStudents()
  csv.js                           # CSV parse/export and triggerDownload()
  app.js                           # App root + ReactDOM.render
  components/                      # One file per React component
build-standalone.js                # Bundles src/ + CDN resources into a single dist file
dist/                              # Built releases
docs/images/                       # Screenshots and assets
```

The app uses vanilla HTML/CSS and React (loaded from CDN in development, inlined in releases). No bundler — Babel-standalone transforms JSX in the browser at load time.

## Running Locally

The source HTML loads JS modules via `<script type="text/babel" src="src/...">`, which Babel-standalone fetches over XHR. Chrome blocks XHR between `file://` URLs, so you need to serve the directory:

```bash
npm run dev
# Opens a static server on http://localhost:3000
```

Then open <http://localhost:3000/class-list-optimizer-source.html> in your browser. Firefox is more permissive and will also load the source from `file://` directly, but `npm run dev` is the recommended path.

## Making Changes

1. Fork the repository
2. Edit the relevant file in `src/` (or `class-list-optimizer-source.html` for HTML/structure changes)
3. Reload the page in your browser to see changes
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
