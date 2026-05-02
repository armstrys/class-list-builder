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

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && fullscreen) setFullscreen(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

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

  function handleReoptimize() {
    const lockedObj = new Map();
    locked.forEach(sid => {
      if (assignment[sid] !== undefined) lockedObj.set(sid, assignment[sid]);
    });
    runOptimize(lockedObj);
  }

  // Auto-reoptimize when criteria change (respecting locked students)
  useEffect(() => {
    if (assignment && Object.keys(assignment).length > 0 && !optimizing) {
      handleReoptimize();
    }
  }, [numericCriteria, flagCriteria]);

  function handleToggleLock(sid) {
    setLocked(prev => {
      const next = new Set(prev);
      next.has(sid) ? next.delete(sid) : next.add(sid);
      return next;
    });
  }

  function handleLockAll() {
    setLocked(new Set(students.map(s => s.id)));
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
        <button className="btn btn-secondary btn-sm" onClick={onBack}>← Setup</button>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleReoptimize}
          disabled={optimizing}
        >
          {optimizing ? '⟳ Optimizing…' : '⟳ Re-Optimize'}
        </button>
        <div className="lock-legend">
          <span className="locked-count">{locked.size}</span>
          <span>locked</span>
          <button className="btn btn-ghost btn-sm" onClick={handleLockAll}>Lock All</button>
          <button className="btn btn-ghost btn-sm" onClick={handleUnlockAll}>Unlock All</button>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Cmd/Ctrl+Z)"
          >
            ↶ Undo
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Cmd/Ctrl+Shift+Z)"
          >
            ↷ Redo
          </button>
        </div>
        {cost !== null && (
          <div className="score-badge">
            <span className="label">Balance score</span>
            <span className="value" style={{ color: costColor }}>{cost.toFixed(4)}</span>
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>(lower is better)</span>
          </div>
        )}
        {totalViolations > 0 && (
          <button
            className="violations-badge"
            onClick={() => setShowViolations(true)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Click to see violated constraints"
          >
            <span style={{ color: 'var(--danger)', fontSize: 12, fontWeight: 500 }}>
              ⚠️ {totalViolations} violation{totalViolations === 1 ? '' : 's'}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>ℹ️</span>
          </button>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', borderRight: '1px solid var(--border)', paddingRight: 10, marginRight: 2 }}>
            {flagCriteria.map(c => (
              <span key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10.5, color: 'var(--text3)' }} title={c.label}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: generateColor(c.key).dot, flexShrink: 0 }} />
                {c.short}
              </span>
            ))}
          </div>
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
          >⬇ Save Lists</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setFullscreen(true)} title="Fullscreen class lists">⛶ Fullscreen</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowHelp(true)}>? How it works</button>
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

      {!fullscreen && <StatsStrip numClasses={numClasses} />}

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
