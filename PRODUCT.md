# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static single-file React 18 SPA, no build step at runtime. JSX is transpiled in
the browser by Babel standalone; `build-standalone.js` inlines `src/**` and all
dependencies into one distributable HTML file. No bundler, no framework router,
no server, no package runtime in the shipped artifact.

## Users

K-12 school staff — classroom teachers, grade-level teams, counselors, and
administrators — who build next year's class rosters. The work happens at the
end of a term, in one sitting, usually on a school laptop or Chromebook, on a
deadline, and the output gets handed to a principal or a grade-level team.

Two people are in the room: the person making the lists, and the colleague or
administrator who has to accept them.

## Product Purpose

Distribute students across classrooms so each class is balanced on academic
scores, intervention needs, gender, and size, while honoring hard constraints
(siblings kept together, students separated). What takes a teacher a full day of
spreadsheet juggling takes minutes and produces a defensible result.

Success is a teacher handing a finished, printable class list to an
administrator without having to justify it by hand.

## Positioning

Two mechanisms a neighboring roster tool could not truthfully copy:

1. **Lock-and-reoptimize.** A teacher can pin individual students to a class,
   then re-run the optimizer around those pins. This converts "the algorithm
   rearranged my students" from a threat into an incremental, reversible
   workflow. Undo/redo covers drag, lock, and constraint actions.
2. **A balance score with named baselines.** The result is scored 0–100 against
   both a *balanced* baseline (unconstrained best case) and a *random*
   baseline, so the number means something a teacher can defend in a meeting
   rather than an opaque cost figure.

Both depend on a deterministic seeded RNG: the same input produces the same
output, so two colleagues can reproduce a list.

## Operating Context

- **Privacy is the product, not a feature.** Student records are FERPA-relevant.
  The app is distributed as a single HTML file that can be saved and opened
  offline, and the README's first line of substance is a claim that data never
  leaves the computer.
- **Delivered two ways:** a hosted GitHub Pages build, and a downloaded
  standalone `class-list-builder-vX.Y.Z.html` for offline use. Both must work.
- **Paper is a real output.** The print report is a first-class surface, not an
  afterthought: a summary page, one page per class, an overview table, and a
  constraints appendix, tuned with density tiers so large classes fit on a page.
- **Class lists are shared artifacts**, so CSV export and a printing layout both
  exist alongside the interactive board.
- Releases are gated: every change to `src/` requires a bumped version, a new
  signed audit document, and matching content hashes.

## Capabilities and Constraints

Confirmed functionality:

- Numeric criteria (averaged per class) and flag criteria (spread across
  classes), each with a user-editable weight.
- Gender and class size are always balanced and are not user-configurable.
- Constraints: Keep Apart (pairs), Keep Together (groups), Keep Out of Class
  (student × class).
- Multi-start simulated annealing with a fixed seed; best-of-N result chosen by
  cost.
- CSV import/export, JSON project save/load with version and criteria
  compatibility checks.
- Light and dark themes, persisted; OS-level prefers-color-scheme is not the
  authority — there is an explicit toggle.
- Analysis and constraints are computed on the main thread.

Technical constraints future work must respect:

- **Single-file, offline-first.** Anything that requires a server, an asset
  pipeline, or a runtime dependency download breaks the offline artifact.
- **No network at runtime.** This is a public claim in `SECURITY.md` and
  `README.md` and is verified by grep in the release audit. Fonts and libraries
  are loaded from CDN in the source HTML but inlined for the release build.
- **The CSP is strict** and lives in the HTML entry: `default-src 'self'`;
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com`;
  `connect-src 'self'`. Babel standalone requires `unsafe-eval`.
- **Determinism is load-bearing.** The RNG seed hashes the criteria config and
  the student set. Any new optimizer input must enter the seed or reproducibility
  silently breaks.
- **Cost is computed in four places that must agree** (`computeCost`,
  `costFromSums`, `swapDelta`, `applySwap`). A new term added to one and not the
  others makes the incremental delta diverge from true cost.
- Terminology is fixed and user-facing: *class* (not section), *criteria*,
  *flags*, *constraints*, *balance score*, *keep apart / keep together / keep out
  of class*. Students have an `id`, `name`, a `gender` of `M`/`F`/`U`, plus
  dynamic criterion keys.

Explicitly undecided:

- Whether a prior-year or prior-homeroom grouping becomes an optimizer input.
  It was proposed and deferred; no such field exists in the data model.

## Brand Commitments

- The name **Class List Builder** and the privacy claim are binding; copy that
  weakens "your data stays on your computer" is out of bounds.
- Voice: plain, direct, second person, no jargon, no exclamation. Written for a
  teacher at the end of a long day. Uses em dashes and sentence-case headings.
- Light mode is the default; dark mode is a peer, not a gimmick.
- The print report always prints light regardless of the on-screen theme. That
  is deliberate and must not be "fixed".

## Evidence on Hand

- `README.md` — feature claims, CSV format documentation, walkthrough, FAQ.
- `docs/images/app-screenshot.png` — the page-level reference screenshot.
- `src/sample-data.js` — realistic demo roster generation, used by the
  first-run "load demo" path.
- `tests/` — 225 passing tests describing optimizer, assessment, CSV, and
  serialization behavior.
- `.security/audits/` — signed release audits with content hashes.

Do not fabricate testimonials, school district names, adoption numbers, or
benchmarks. None exist in the repo.

## Product Principles

1. **The number must be defensible.** Every aggregate the app shows a teacher
   should be explainable in one sentence to an administrator. If a score can't be
   justified, it shouldn't be on screen.
2. **The teacher's judgment outranks the optimizer.** Locks, manual moves, and
   undo exist so the human can override the machine, not the reverse.
3. **Privacy claims are verified, not asserted.** Code that weakens
   offline/no-network guarantees is a product regression, not just a technical
   one.
4. **The work ends on paper or in a file.** A finished session must produce
   something that leaves the app.
5. **Nothing is destroyed silently.** Rosters and assignments are expensive to
   rebuild; a destructive action needs a confirmation or an undo.

## Accessibility & Inclusion

No formal standard has been declared for this product. The codebase's incumbent
practice (as of the v3.2.0 accessibility pass) is:

- Keyboard access to every primary workflow, including moving a student between
  classes without a mouse.
- Dialogs render through a portal so `aria-hidden` on the app root cannot
  silence them; focus is trapped and restored.
- Status changes (optimizing, constraint violations, balance score) are
  announced through a live region.
- Text meets WCAG AA contrast (4.5:1) in both themes.
- `prefers-reduced-motion` is respected.

These are implementation facts, not yet a stated product commitment. If a
standard is adopted, it belongs here.
