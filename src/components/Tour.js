/**
 * Tour - Numbered walkthrough that points at real controls in the app.
 *
 * Anchor-based rather than measure-and-overlay: each step names a target and
 * its copy, and the shared `currentTourStep` value drives a highlight ring on
 * whichever control carries the matching `data-tour` attribute. A step whose
 * target is not rendered (e.g. an empty roster) simply has no ring, so the
 * step list stays a complete map of the app instead of a script that breaks.
 *
 * @param {number} currentTourStep - Active step, or null when the tour is off
 * @param {Function} setCurrentTourStep - Setter; null turns the tour off
 */

const TOUR_STEPS = [
  { target: 'classes', title: 'Classes', body: 'Set the number of classes and rename them if you want. Everything else balances across these.' },
  { target: 'criteria', title: 'Criteria', body: 'Choose what gets balanced — scores, flags like intervention needs, and weights.' },
  { target: 'import', title: 'Students', body: 'Upload a filled-in spreadsheet here — the same dialog has a blank template that already matches your criteria. Excel works too, or add students by hand.' },
  { target: 'constraints', title: 'Constraints', body: 'Keep students apart, keep them together, or keep one out of a class.' },
  { target: 'save', title: 'Save and load', body: 'Save this project to a file and reopen it later, on this computer or another.' },
  { target: 'optimize', title: 'Optimize', body: 'When you are ready, go. The board opens next.' },
];

function Tour({ currentTourStep, setCurrentTourStep }) {
  if (currentTourStep === null || currentTourStep === undefined) return null;

  const step = TOUR_STEPS[currentTourStep];
  const last = currentTourStep === TOUR_STEPS.length - 1;
  const go = n => setCurrentTourStep(Math.max(0, Math.min(TOUR_STEPS.length - 1, n)));

  return (
    <div className="tour-panel" role="region" aria-label="Guided tour">
      <div className="tour-head">
        <span className="tour-count">
          Step {currentTourStep + 1} of {TOUR_STEPS.length}
        </span>
        <button
          className="btn btn-ghost btn-sm tour-close"
          onClick={() => setCurrentTourStep(null)}
          aria-label="End tour"
        >
          ✕
        </button>
      </div>

      <div aria-live="polite">
        <div className="tour-title">{step.title}</div>
        <p className="tour-body">{step.body}</p>
      </div>

      {last ? (
        <div className="tour-finish">
          <strong>On the board:</strong> drag students between classes, lock the ones
          you want to keep, then re-optimize around them. Save the lists as CSV or
          print the report from the toolbar when the result looks right.
        </div>
      ) : null}

      <div className="tour-dots">
        {TOUR_STEPS.map((s, i) => (
          <button
            key={s.target}
            className={`tour-dot ${i === currentTourStep ? 'active' : ''}`}
            onClick={() => go(i)}
            aria-label={`Step ${i + 1}: ${s.title}`}
            aria-current={i === currentTourStep ? 'step' : undefined}
          />
        ))}
      </div>

      <div className="tour-actions">
        <button className="btn btn-ghost btn-sm" onClick={() => setCurrentTourStep(null)}>
          {last ? 'End tour' : 'Skip'}
        </button>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => go(currentTourStep - 1)}
            disabled={currentTourStep === 0}
          >
            ← Back
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => (last ? setCurrentTourStep(null) : go(currentTourStep + 1))}
          >
            {last ? 'Start with my data' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}
