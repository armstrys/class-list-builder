/**
 * Tour - Numbered walkthrough that points at real controls in the app.
 *
 * Each step names a target; the callout measures whichever rendered control
 * carries that `data-tour` attribute, rings it, and positions itself beside it
 * with an arrow pointing at it. A step whose target is not rendered falls back
 * to a fixed corner card instead of breaking, so the step list stays a map of
 * the app rather than a recorded script.
 *
 * @param {number} currentTourStep - Active step, or null when the tour is off
 * @param {Function} setCurrentTourStep - Setter; null turns the tour off
 */

const TOUR_STEPS = [
  {
    target: 'classes',
    title: 'Classes',
    body: 'Set how many classes you are building and rename them. Everything balances across these.',
  },
  {
    target: 'criteria',
    title: 'Criteria',
    body: 'Choose what gets balanced — scores, flags like intervention needs, and how much each one counts.',
  },
  {
    target: 'import',
    title: 'Students',
    body: 'Upload your roster here. The same dialog offers a blank template with your criteria as the column headers; Excel files work too.',
  },
  {
    target: 'constraints',
    title: 'Constraints',
    body: 'Keep students apart, keep them together, or keep one out of a particular class.',
  },
  {
    target: 'save',
    title: 'Save and load',
    body: 'Save the whole project to a file and reopen it later, on this computer or another one.',
  },
  {
    target: 'optimize',
    title: 'Optimize',
    body: 'When you are ready, run it. The board opens next: drag students, lock the ones you keep, then re-optimize around them.',
  },
];

const CALLOUT_WIDTH = 300;
const GAP = 14;
// Room around the spotlighted control so the ring sits inside the hole.
const HOLE_PAD = 8;

/**
 * The rendered control a step names, or null when nothing matches.
 *
 * More than one control may carry the same target, in priority order: a step
 * whose primary control is conditional (Save Project only exists once there
 * are students) falls back to the always-present one next to it instead of
 * dropping the callout into the docked corner.
 */
function targetEl(step) {
  const all = document.querySelectorAll(`[data-tour="${TOUR_STEPS[step].target}"]`);
  // getClientRects() is empty for display:none. Chosen over offsetParent,
  // which is also null for position:fixed — a false negative this header
  // could easily acquire.
  return [...all].find(el => el.getClientRects().length > 0) || null;
}

function Tour({ currentTourStep, setCurrentTourStep }) {
  const [pos, setPos] = useState(null);

  // Measure the target after every step or viewport change. Layout is already
  // committed by the time this runs, so the rect is the real one.
  useEffect(() => {
    if (currentTourStep === null) return;

    function place() {
      const el = targetEl(currentTourStep);
      if (!el) {
        setPos({ anchored: false });
        return;
      }
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const below = vh - r.bottom;
      // Prefer underneath; flip above when the viewport is short there.
      const placeBelow = below > 190 || r.top < 190;
      const centerX = r.left + r.width / 2;
      const left = Math.max(8, Math.min(vw - CALLOUT_WIDTH - 8, centerX - CALLOUT_WIDTH / 2));
      setPos({
        anchored: true,
        left,
        top: placeBelow ? r.bottom + GAP : r.top - GAP,
        above: !placeBelow,
        arrowX: Math.max(16, Math.min(CALLOUT_WIDTH - 16, centerX - left)),
        // The scrim cuts its hole from this, so it must be the same rect the
        // ring is drawn on.
        rect: { top: r.top, left: r.left, width: r.width, height: r.height },
      });
    }

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [currentTourStep]);

  // Ring the target. Separate effect so the class and the measurement agree.
  useEffect(() => {
    if (currentTourStep === null) return;
    const el = targetEl(currentTourStep);
    if (!el) return;
    el.classList.add('tour-target');
    return () => el.classList.remove('tour-target');
  }, [currentTourStep]);

  if (currentTourStep === null || currentTourStep === undefined) return null;

  const step = TOUR_STEPS[currentTourStep];
  const last = currentTourStep === TOUR_STEPS.length - 1;
  const go = n => setCurrentTourStep(Math.max(0, Math.min(TOUR_STEPS.length - 1, n)));

  const anchored = pos && pos.anchored;
  const style = anchored
    ? {
        left: pos.left,
        top: pos.top,
        width: CALLOUT_WIDTH,
        transform: pos.above ? 'translateY(-100%)' : undefined,
      }
    : {};

  // Shade everything except the control this step names, and let that hole
  // close around the control's own corners. Purely visual: pointer-events are
  // off, so the tour stays non-modal and nothing becomes unclickable.
  const dim =
    pos && pos.rect ? (
      <div
        className="tour-dim tour-dim-hole"
        style={{
          left: pos.rect.left - HOLE_PAD,
          top: pos.rect.top - HOLE_PAD,
          width: pos.rect.width + HOLE_PAD * 2,
          height: pos.rect.height + HOLE_PAD * 2,
        }}
        aria-hidden="true"
      />
    ) : (
      <div className="tour-dim" aria-hidden="true" />
    );

  return (
    <>
      {dim}
      <div
        className={`tour-panel ${anchored ? 'tour-anchored' : 'tour-docked'}`}
        style={style}
        role="region"
        aria-label="Guided tour"
      >
        {anchored && (
          <svg
            className={`tour-arrow ${pos.above ? 'tour-arrow-down' : 'tour-arrow-up'}`}
            style={{ left: pos.arrowX }}
            viewBox="0 0 16 8"
            aria-hidden="true"
          >
            <polyline points={pos.above ? '0,0 8,8 16,0' : '0,8 8,0 16,8'} />
          </svg>
        )}

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
    </>
  );
}
