/**
 * OptimizePage - Main optimization results view with drag-and-drop class management.
 *
 * Uses contexts:
 * - useStudents: Student data, constraints, assignments, locks
 * - useCriteria: Criteria configuration
 * - useAppState: teachers/classes
 *
 * @param {Object} props
 * @param {Function} props.onBack - Navigate back to setup view
 */
function OptimizePage({ onBack }) {
  // Get data from contexts
  const {
    students,
    keepApart,
    keepTogether,
    keepOutOfClass,
    assignment,
    setAssignment,
    locked,
    setLocked,
    assessment,
    setAssessment,
    isAssessing,
    setIsAssessing,
    addKeepApart,
    removeKeepApart,
    addKeepTogether,
    removeKeepTogether,
    addKeepOutOfClass,
    removeKeepOutOfClass,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useStudentsExport();

  const { numericCriteria, flagCriteria, categoryCriteria } = useCriteriaExport();
  const { teachers, setTeachers } = useAppStateExport();
  const [draggingId, setDraggingId] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showConstraints, setShowConstraints] = useState(false);
  const [showViolations, setShowViolations] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showClassFilter, setShowClassFilter] = useState(false);
  const [visibleClasses, setVisibleClasses] = useState(new Set());
  const [showAssessment, setShowAssessment] = useState(false);

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef(null);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && fullscreen) setFullscreen(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  // Close More menu on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false);
      }
    }
    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMoreMenu]);

  // Initialize visible classes when teachers change
  useEffect(() => {
    setVisibleClasses(new Set(teachers.map((_, i) => i)));
  }, [teachers.length]);

  const numClasses = teachers.length;

  const runOptimize = useCallback((lockedAssignments) => {
    setOptimizing(true);
    setTimeout(() => {
      const lockedObj = {};
      lockedAssignments.forEach((classIdx, sid) => { lockedObj[sid] = classIdx; });
      // Multi-start: the balance assessment scores against a best-of-N
      // baseline, so a single trajectory would leave points on the table
      // even with no constraints. Restarts are cheap (~20ms each).
      const result = optimizeMultiStart(students, numClasses, lockedObj, numericCriteria, flagCriteria, keepApart, keepTogether, keepOutOfClass, undefined, categoryCriteria);
      setAssignment(result);
      setOptimizing(false);
    }, 30);
  }, [students, numClasses, numericCriteria, flagCriteria, categoryCriteria, keepApart, keepTogether, keepOutOfClass, setAssignment]);

  useEffect(() => {
    // Only run initial optimization if we don't have an assignment yet
    if (!assignment || Object.keys(assignment).length === 0) {
      runOptimize(new Map());
    }
  }, [assignment, runOptimize]);

  // Auto-run assessment when assignment changes
  useEffect(() => {
    if (!students.length || !Object.keys(assignment).length) {
      setAssessment(null);
      return;
    }

    let cancelled = false;

    async function runAssessment() {
      setIsAssessing(true);
      try {
        const result = await runFullAssessment({
          students,
          assignment,
          numClasses,
          numericCriteria,
          flagCriteria,
          categoryCriteria,
          keepApart,
          keepTogether,
          keepOutOfClass,
        });
        if (!cancelled) {
          setAssessment(result);
        }
      } catch (e) {
        console.error('Assessment failed:', e);
      } finally {
        if (!cancelled) {
          setIsAssessing(false);
        }
      }
    }

    runAssessment();

    return () => {
      cancelled = true;
    };
    // The constraint sets belong in the deps: the assessment includes their
    // penalties, so adding a violated constraint changes the true cost without
    // touching the assignment. They are safe as deps — each is a `useState`
    // array in the students context, so identity is stable between renders and
    // this cannot re-trigger itself.
  }, [students, assignment, numClasses, numericCriteria, flagCriteria, categoryCriteria, keepApart, keepTogether, keepOutOfClass]);

  const handleReoptimize = useCallback(() => {
    const lockedObj = new Map();
    locked.forEach(sid => {
      if (assignment[sid] !== undefined) lockedObj.set(sid, assignment[sid]);
    });
    runOptimize(lockedObj);
  }, [locked, assignment, runOptimize]);

  // Auto-reoptimize when criteria change (respecting locked students).
  // Deps are intentionally limited to the criteria sets — adding assignment/
  // optimizing/handleReoptimize would re-trigger this on every reoptimize
  // result and cause a runaway loop. All three criteria sets belong here: a
  // category weight changes what runOptimize is asked to optimise, so leaving
  // it out left the board on its old trajectory.
  useEffect(() => {
    if (assignment && Object.keys(assignment).length > 0 && !optimizing) {
      handleReoptimize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericCriteria, flagCriteria, categoryCriteria]);

  function handleToggleLock(sid) {
    setLocked(prev => {
      const next = new Set(prev);
      next.has(sid) ? next.delete(sid) : next.add(sid);
      return next;
    });
  }

  function handleUnlockAll() {
    setLocked(new Set());
  }

  function handleDragStart(e, sid) {
    setDraggingId(sid);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', sid);
  }

  function moveStudent(sid, classIdx) {
    if (!sid) return;
    setAssignment({ ...assignment, [sid]: classIdx });
    setDraggingId(null);
  }

  function handleDrop(e, classIdx) {
    moveStudent(e.dataTransfer.getData('text/plain') || draggingId, classIdx);
  }

  // Memoize violation calculations to prevent re-computation on every render
  const violations = useMemo(() => {
    const apartViolations = keepApart.filter(([id1, id2]) => {
      const c1 = assignment[id1];
      const c2 = assignment[id2];
      return c1 !== undefined && c2 !== undefined && c1 === c2;
    });

    const togetherViolations = keepTogether.filter(group => {
      if (group.length < 2) return false;
      const classes = new Set();
      for (const id of group) {
        const c = assignment[id];
        if (c !== undefined) classes.add(c);
      }
      return classes.size > 1;
    });

    const outOfClassViolations = keepOutOfClass.filter(({ studentId, classIndex }) => {
      const assignedClass = assignment[studentId];
      return assignedClass !== undefined && assignedClass === classIndex;
    });

    return {
      apartViolations,
      togetherViolations,
      outOfClassViolations,
      totalViolations: apartViolations.length + togetherViolations.length + outOfClassViolations.length
    };
  }, [keepApart, keepTogether, keepOutOfClass, assignment]);

  const { apartViolations, togetherViolations, outOfClassViolations, totalViolations } = violations;

  // Students in no class. The balance score is computed over placed students
  // (#103), so it has to say how many students it is about — otherwise the
  // number describes a subset the teacher cannot see. A card on the board
  // requires a valid class index, so these students match no column.
  const unplaced = useMemo(() =>
    students.filter(s => {
      const c = assignment[s.id];
      return !(c >= 0 && c < numClasses);
    }),
    [students, assignment, numClasses]
  );

  // Memoize class grouping and sorting
  const classesByIdx = useMemo(() =>
    Array.from({ length: numClasses }, (_, i) =>
      students.filter(s => assignment[s.id] === i)
        .sort((a, b) => {
          const aLocked = locked.has(a.id) ? 1 : 0;
          const bLocked = locked.has(b.id) ? 1 : 0;
          if (aLocked !== bLocked) return aLocked - bLocked;
          return a.name.localeCompare(b.name);
        })
    ),
    [students, assignment, locked, numClasses]
  );

  return (
    <div className="optimize-layout" style={fullscreen ? { position: 'fixed', inset: 0, zIndex: 500, background: 'var(--bg)' } : {}}>
      {!fullscreen && <div className="optimize-toolbar">
        {/* Left: Navigation & primary actions */}
        <button className="btn btn-secondary btn-sm" onClick={onBack}>← Setup</button>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleReoptimize}
          disabled={optimizing}
        >
          {optimizing ? '⟳ Optimizing…' : '⟳ Re-Optimize'}
        </button>

        {/* Lock count — info only, no actions */}
        <div className="lock-badge" title={`${locked.size} student${locked.size === 1 ? '' : 's'} locked. Use individual lock icons in class lists.`}>
          <span className="lock-icon">🔒</span>
          <span className="locked-count">{locked.size}</span>
        </div>

        {/* Undo / Redo — icon buttons */}
        <div className="toolbar-icon-group">
          <button
            className="btn btn-ghost btn-sm toolbar-icon-btn"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Cmd/Ctrl+Z)"
            aria-label="Undo"
          >
            ↶
          </button>
          <button
            className="btn btn-ghost btn-sm toolbar-icon-btn"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Cmd/Ctrl+Shift+Z)"
            aria-label="Redo"
          >
            ↷
          </button>
        </div>

        {/* Assessment score badge */}
        {assessment && assessment.ready && (
          <div
            className="score-badge"
            onClick={() => setShowAssessment(true)}
            style={{ cursor: 'pointer' }}
            title="Click to view detailed assessment"
          >
            <span className="label">Balance</span>
            <span
              className="value"
              style={{
                color: assessment.score >= 80 ? 'var(--accent)' : assessment.score >= 50 ? 'var(--amber)' : 'var(--danger)',
              }}
            >
              {assessment.score}
            </span>
            {unplaced.length > 0 && (
              <span
                className="label"
                style={{ color: 'var(--amber)' }}
                title={`${unplaced.length} student${unplaced.length === 1 ? '' : 's'} in no class. The balance score counts placed students only.`}
              >
                {unplaced.length} not placed
              </span>
            )}
          </div>
        )}
        {isAssessing && (
          <div className="score-badge">
            <span className="label">Balance</span>
            <span className="value" style={{ color: 'var(--text3)' }}>…</span>
          </div>
        )}

        {/* Violations — always visible */}
        <button
          className="violations-badge"
          onClick={() => totalViolations > 0 && setShowViolations(true)}
          style={{ cursor: totalViolations > 0 ? 'pointer' : 'default' }}
          title={(() => {
            const apartTotal = keepApart.length;
            const togetherTotal = keepTogether.length;
            const outTotal = keepOutOfClass.length;
            const lines = [];
            if (apartTotal > 0) {
              const v = apartViolations.length;
              lines.push(`Keep Apart: ${apartTotal - v}/${apartTotal} satisfied${v > 0 ? ` (${v} violation${v === 1 ? '' : 's'})` : ' ✓'}`);
            }
            if (togetherTotal > 0) {
              const v = togetherViolations.length;
              lines.push(`Keep Together: ${togetherTotal - v}/${togetherTotal} satisfied${v > 0 ? ` (${v} violation${v === 1 ? '' : 's'})` : ' ✓'}`);
            }
            if (outTotal > 0) {
              const v = outOfClassViolations.length;
              lines.push(`Keep Out of Class: ${outTotal - v}/${outTotal} satisfied${v > 0 ? ` (${v} violation${v === 1 ? '' : 's'})` : ' ✓'}`);
            }
            if (lines.length === 0) return 'No constraints configured';
            if (totalViolations === 0) return 'All constraints satisfied! ✓\n' + lines.join('\n');
            return `${totalViolations} violation${totalViolations === 1 ? '' : 's'} total\n` + lines.join('\n');
          })()}
        >
          {totalViolations > 0 ? (
            <span style={{ color: 'var(--danger)', fontSize: 12, fontWeight: 500 }}>
              ⚠️ {totalViolations}
            </span>
          ) : (
            <span style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 500 }}>
              ✓ All constraints met
            </span>
          )}
        </button>

        {/* Right: Actions */}
        <div className="toolbar-actions">
          <ClassFilterDropdown
            visibleClasses={visibleClasses}
            setVisibleClasses={setVisibleClasses}
            showClassFilter={showClassFilter}
            setShowClassFilter={setShowClassFilter}
            students={students}
            assignment={assignment}
          />
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowConstraints(true)}
            title="View and edit constraints"
          >
            🔗 Constraints {(keepApart.length + keepTogether.length + keepOutOfClass.length) > 0 && `(${keepApart.length + keepTogether.length + keepOutOfClass.length})`}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => triggerDownload(exportClassListsToCSV(students, assignment, teachers, numericCriteria, flagCriteria, categoryCriteria), 'class-lists.csv', 'text/csv')}
            title="Save class lists as CSV"
          >
            ⬇ Save Lists
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => window.print()}
            disabled={Object.keys(assignment).length === 0}
            title={Object.keys(assignment).length === 0 ? 'Run optimization first' : 'Print class list report'}
          >
            🖨 Print Report
          </button>
          <button
            className="btn btn-ghost btn-sm toolbar-icon-btn"
            onClick={() => setFullscreen(true)}
            title="Fullscreen class lists"
            aria-label="Fullscreen"
          >
            ⛶
          </button>
          <button
            className="btn btn-ghost btn-sm toolbar-icon-btn"
            onClick={() => setShowHelp(true)}
            title="How it works"
            aria-label="How it works"
          >
            ?
          </button>

          {/* More dropdown — only Unlock All remains */}
          <div ref={moreMenuRef} className="toolbar-dropdown">
            <button
              className="btn btn-ghost btn-sm toolbar-icon-btn"
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              title="More actions"
              aria-label="More actions"
            >
              ⋯
            </button>
            {showMoreMenu && (
              <div className="toolbar-dropdown-menu">
                <button
                  className="toolbar-dropdown-item toolbar-dropdown-item-danger"
                  onClick={() => { handleUnlockAll(); setShowMoreMenu(false); }}
                  disabled={locked.size === 0}
                  title={locked.size === 0 ? 'No students are locked' : `Unlock all ${locked.size} locked students`}
                >
                  <span>🔓</span>
                  <span>Unlock All</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>}

      {/* Announce status changes: without this, optimizing, the balance score
          and violation counts all change silently for screen-reader users. */}
      <div className="sr-only" role="status" aria-live="polite">
        {optimizing ? 'Optimizing class lists.' : ''}
        {totalViolations > 0
          ? `${totalViolations} constraint violation${totalViolations === 1 ? '' : 's'}.`
          : 'All constraints met.'}
        {assessment && assessment.ready ? ` Balance score ${assessment.score} out of 100.` : ''}
        {unplaced.length > 0 ? ` ${unplaced.length} student${unplaced.length === 1 ? '' : 's'} not placed in a class.` : ''}
      </div>

      {/* A student added after the optimizer ran has no entry in `assignment`,
          and every column renders `assignment[s.id] === i`, so that student
          matches no column and appears nowhere on this screen. They get a pool
          of their own: drag a card onto a class, or open it for the class
          picker. Re-Optimize is deliberately not the only answer here — it
          re-seeds placements the teacher may already have accepted. */}
      {unplaced.length > 0 && (
        <div
          className="unplaced-pool"
          role="region"
          aria-label={`${unplaced.length} student${unplaced.length === 1 ? '' : 's'} not placed in a class`}
        >
          <div className="unplaced-pool-header">
            <span className="unplaced-pool-title">Not placed ({unplaced.length})</span>
            <span className="unplaced-pool-hint">Drag onto a class, or open a card to choose one.</span>
          </div>
          <div className="unplaced-pool-cards">
            {unplaced.map(s => (
              <StudentCard
                key={s.id}
                student={s}
                unplaced
                locked={false}
                onToggleLock={handleToggleLock}
                onDragStart={handleDragStart}
                dragging={draggingId === s.id}
                flagCriteria={flagCriteria}
                numericCriteria={numericCriteria}
                keepApart={keepApart}
                keepTogether={keepTogether}
                keepOutOfClass={keepOutOfClass}
                allStudents={students}
              />
            ))}
          </div>
        </div>
      )}

      <div className="classes-area" style={{ flex: 1 }}>
        {classesByIdx.map((classStudents, i) => (
          visibleClasses.has(i) && (
          <ClassColumn
            key={i}
            classIdx={i}
            name={teachers[i]?.name || `Class ${i + 1}`}
            onNameChange={(idx, val) => setTeachers(prev => prev.map((t, j) => j === idx ? { ...t, name: val } : t))}
            students={classStudents}
            onToggleLock={handleToggleLock}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            draggingId={draggingId}
            allStudents={students}
            fullscreen={fullscreen}
          />
          )
        ))}
      </div>

      {fullscreen && (
        <button
          onClick={() => setFullscreen(false)}
          style={{
            position: 'fixed', top: 12, right: 16, zIndex: 200,
            background: 'var(--surface)', border: '1.5px solid var(--border)',
            borderRadius: 'var(--radius-sm)', padding: '6px 12px',
            cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
            fontWeight: 500, color: 'var(--text2)',
            boxShadow: 'var(--shadow)',
          }}
        >
          ✕ Exit Fullscreen (Esc)
        </button>
      )}

      {showAssessment && (
        <AssessmentModal
          onClose={() => setShowAssessment(false)}
          assessment={assessment}
          isAssessing={isAssessing}
        />
      )}

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {showConstraints && (
        <ConstraintModal onClose={() => setShowConstraints(false)} />
      )}

      {showViolations && (
        <ViolationsModal
          apartViolations={apartViolations}
          togetherViolations={togetherViolations}
          outOfClassViolations={outOfClassViolations}
          students={students}
          assignment={assignment}
          onClose={() => setShowViolations(false)}
          onOpenConstraints={() => {
            setShowViolations(false);
            setShowConstraints(true);
          }}
        />
      )}

      <PrintReportView />
    </div>
  );
}
