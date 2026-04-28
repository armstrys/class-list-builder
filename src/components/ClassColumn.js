/**
 * ClassColumn - Display a single class column with students
 * 
 * Uses contexts:
 * - useStudents: For locked state and constraint info
 * - useCriteria: For criteria configuration
 * 
 * @param {Object} props
 * @param {number} props.classIdx - Class index
 * @param {string} props.name - Class name
 * @param {Function} props.onNameChange - Name change callback
 * @param {Array} props.students - Students in this class
 * @param {Function} props.onToggleLock - Lock toggle callback
 * @param {Function} props.onDragStart - Drag start callback
 * @param {Function} props.onDrop - Drop callback
 * @param {string|null} props.draggingId - Currently dragging student ID
 * @param {Array} props.allStudents - All students for population stats
 * @param {boolean} props.fullscreen - Whether in fullscreen mode
 */
function ClassColumn({ classIdx, name, onNameChange, students, onToggleLock, onDragStart, onDrop, draggingId, allStudents, fullscreen, teachers = [] }) {
  // Get criteria and locked state from contexts
  const { locked, keepApart, keepTogether, keepOutOfClass } = useStudentsExport();
  const { numericCriteria, flagCriteria } = useCriteriaExport();
  
  const [dragOver, setDragOver] = useState(false);

  const avg = key => students.length
    ? students.reduce((s, st) => s + (st[key] || 0), 0) / students.length
    : 0;

  const popMin = key => allStudents.length ? Math.min(...allStudents.map(s => s[key] || 0)) : 0;
  const popMax = key => allStudents.length ? Math.max(...allStudents.map(s => s[key] || 0)) : 1;

  const numStats = numericCriteria.map(m => {
    const mn = popMin(m.key), mx = popMax(m.key);
    const range = mx - mn || 1;
    const classAvg = avg(m.key);
    return {
      label: m.short,
      val: Math.round(classAvg),
      pct: Math.min(100, Math.max(4, (classAvg - mn) / range * 100)),
    };
  });

  const boolCounts = flagCriteria.map(m => ({
    label: m.short,
    val: students.filter(s => s[m.key]).length,
    colors: generateColor(m.key),
  })).filter(b => b.val > 0);

  const classTotalFlagsCount = students.reduce(
    (sum, s) => sum + flagCriteria.reduce((fs, { key }) => fs + (s[key] ? 1 : 0), 0),
    0
  );

  return (
    <div
      className={`class-col${dragOver ? ' drag-over' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); onDrop(e, classIdx); }}
    >
      <div className="class-col-header">
        <div className="teacher-num">{classIdx + 1}</div>
        <input
          className="class-col-name-input"
          value={name}
          onChange={e => onNameChange(classIdx, e.target.value)}
          aria-label={`Class ${classIdx + 1} name`}
        />
        <span className="class-count">{students.length}</span>
      </div>

      <div className="class-col-cards">
        {students.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text3)', fontSize: 12 }}>
            Drop students here
          </div>
        )}
        {students.map((s, i) => {
          const isLocked = locked.has(s.id);
          const prevLocked = i > 0 && locked.has(students[i - 1].id);
          const showDivider = isLocked && !prevLocked && i > 0;
          return (
            <React.Fragment key={s.id}>
              {showDivider && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '3px 0' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>Locked</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
              )}
              <StudentCard
                student={s}
                locked={isLocked}
                onToggleLock={onToggleLock}
                onDragStart={onDragStart}
                dragging={draggingId === s.id}
                flagCriteria={flagCriteria}
                numericCriteria={numericCriteria}
                keepApart={keepApart}
                keepTogether={keepTogether}
                keepOutOfClass={keepOutOfClass}
                allStudents={allStudents}
                teachers={teachers}
              />
            </React.Fragment>
          );
        })}
      </div>

      <div className="class-col-footer" style={fullscreen ? { display: 'none' } : {}}>
        {numStats.map(stat => (
          <div key={stat.label} className="class-stat-row">
            <span className="class-stat-label">{stat.label}</span>
            <div className="class-stat-bar-wrap">
              <div className="class-stat-bar" style={{ width: stat.pct + '%' }} />
            </div>
            <span className="class-stat-val">{stat.val}</span>
          </div>
        ))}
        {boolCounts.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
            {boolCounts.map(b => (
              <span key={b.label} className="badge" style={{ background: b.colors.bg, color: b.colors.fg }}>{b.label} {b.val}</span>
            ))}
          </div>
        )}
        {flagCriteria.length > 0 && (
          <div style={{ marginTop: 5, fontSize: 11, color: 'var(--text2)' }}>
            Total Flags: <strong style={{ color: 'var(--text1)', fontFamily: "'DM Mono', monospace" }}>{classTotalFlagsCount}</strong>
          </div>
        )}
      </div>
    </div>
  );
}
