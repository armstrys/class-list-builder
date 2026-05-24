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

  const { numericCriteria, flagCriteria } = useCriteriaExport();
  const { teachers, setTeachers } = useAppStateExport();
  const [draggingId, setDraggingId] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showConstraints, setShowConstraints] = useState(false);
  const [showViolations, setShowViolations] = useState(false);
  const [cost, setCost] = useState(null);
  const [optimizing, setOptimizing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showClassFilter, setShowClassFilter] = useState(false);
  const [visibleClasses, setVisibleClasses] = useState(new Set());

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
      const result = optimize(students, numClasses, lockedObj, numericCriteria, flagCriteria, keepApart, keepTogether, keepOutOfClass);
      setAssignment(result);
      setCost(computeCost(students, result, numClasses, numericCriteria, flagCriteria, keepApart, keepTogether, keepOutOfClass));
      setOptimizing(false);
    }, 30);
  }, [students, numClasses, numericCriteria, flagCriteria, keepApart, keepTogether, keepOutOfClass, setAssignment]);

  useEffect(() => {
    // Only run initial optimization if we don't have an assignment yet
    if (!assignment || Object.keys(assignment).length === 0) {
      runOptimize(new Map());
    }
  }, [assignment, runOptimize]);

  // Recompute cost when criteria change (to reflect new weights in display)
  useEffect(() => {
    if (assignment && Object.keys(assignment).length > 0) {
      setCost(computeCost(students, assignment, numClasses, numericCriteria, flagCriteria, keepApart, keepTogether, keepOutOfClass));
    }
  }, [numericCriteria, flagCriteria, students, assignment, numClasses, keepApart, keepTogether, keepOutOfClass]);

  const handleReoptimize = useCallback(() => {
    const lockedObj = new Map();
    locked.forEach(sid => {
      if (assignment[sid] !== undefined) lockedObj.set(sid, assignment[sid]);
    });
    runOptimize(lockedObj);
  }, [locked, assignment, runOptimize]);

  // Auto-reoptimize when criteria change (respecting locked students).
  // Deps are intentionally limited to criteria — adding assignment/optimizing/
  // handleReoptimize would re-trigger this on every reoptimize result and
  // cause a runaway loop.
  useEffect(() => {
    if (assignment && Object.keys(assignment).length > 0 && !optimizing) {
      handleReoptimize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericCriteria, flagCriteria]);

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

  function handleDrop(e, classIdx) {
    const sid = e.dataTransfer.getData('text/plain') || draggingId;
    if (!sid) return;
    const newAssignment = { ...assignment, [sid]: classIdx };
    setAssignment(newAssignment);
    setCost(computeCost(students, newAssignment, numClasses, numericCriteria, flagCriteria, keepApart, keepTogether, keepOutOfClass));
    setDraggingId(null);
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

  const costColor = cost !== null
    ? (cost < 0.05 ? 'var(--accent)' : cost < 0.15 ? 'var(--amber)' : 'var(--danger)')
    : 'var(--text3)';

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

        {/* Score badge */}
        {cost !== null && (
          <div className="score-badge">
            <span className="label">Balance</span>
            <span className="value" style={{ color: costColor }}>{cost.toFixed(4)}</span>
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
            onClick={() => triggerDownload(exportClassListsToCSV(students, assignment, teachers, numericCriteria, flagCriteria), 'class-lists.csv', 'text/csv')}
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

      <div className="classes-area" style={{ flex: 1 }}>
        {classesByIdx.map((classStudents, i) => (
          visibleClasses.has(i) && (
          <ClassColumn
            key={i}
            classIdx={i}
            name={teachers[i]?.name || `Class ${i + 1}`}
            onNameChange={(idx, val) => setTeachers(prev => prev.map((t, j) => j === idx ? { ...t, name: val } : t))}
            students={classStudents}
            locked={locked}
            onToggleLock={handleToggleLock}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            draggingId={draggingId}
            allStudents={students}
            fullscreen={fullscreen}
            numericCriteria={numericCriteria}
            flagCriteria={flagCriteria}
            keepApart={keepApart}
            keepTogether={keepTogether}
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
    </div>
  );
}
