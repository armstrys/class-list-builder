/**
 * OutOfClassTab - Keep Out of Class constraint management
 * 
 * @param {Object} props
 * @param {Array} props.students - All students
 * @param {Array} props.teachers - Class/teacher definitions
 * @param {Array} props.keepOutOfClass - Current blocked assignments
 * @param {Function} props.onAddKeepOutOfClass - Add constraint callback
 * @param {Function} props.onRemoveKeepOutOfClass - Remove constraint callback
 */
function OutOfClassTab({ students, teachers, keepOutOfClass, onAddKeepOutOfClass, onRemoveKeepOutOfClass }) {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedClassIndex, setSelectedClassIndex] = useState('');
  const [filter, setFilter] = useState('');

  const studentById = Object.fromEntries(students.map(s => [s.id, s]));

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(filter.toLowerCase())
  );

  const constraints = keepOutOfClass.map((c, idx) => {
    const classIndex = Number(c.classIndex);
    const teacherName = teachers[classIndex]?.name || `Class ${classIndex + 1}`;
    return {
      idx,
      studentId: c.studentId,
      classIndex,
      studentName: studentById[c.studentId]?.name || c.studentId,
      teacherName,
    };
  });

  function handleAdd() {
    if (selectedStudentId && selectedClassIndex !== '') {
      onAddKeepOutOfClass(selectedStudentId, parseInt(selectedClassIndex, 10));
      setSelectedStudentId('');
      setSelectedClassIndex('');
    }
  }

  return (
    <>
      {/* Existing Constraints */}
      <div style={{ marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 500 }}>
          Active Keep-Out-of-Class Constraints ({constraints.length})
        </h4>
        {constraints.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: 13, padding: '12px 0' }}>
            No keep-out-of-class constraints set yet. These students will be blocked from specific classes.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {constraints.map((c) => (
              <div key={c.idx} className="constraint-item" style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
                    {c.studentName}
                  </span>
                  <span style={{ color: 'var(--text3)' }}>cannot be in</span>
                  <span className="badge" style={{ background: 'var(--warning)', color: 'white' }}>
                    {c.teacherName}
                  </span>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => onRemoveKeepOutOfClass(c.studentId, c.classIndex)}
                    title="Remove this constraint"
                    style={{ marginLeft: 'auto' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add New */}
      <div>
        <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 500 }}>
          Add Keep-Out-of-Class Constraint
        </h4>
        <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--text3)' }}>
          Select a student and class to block them from that class.
        </p>

        <input
          type="text"
          className="form-input"
          placeholder="Filter students by name..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ marginBottom: 12 }}
        />

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 500 }}>
            Select Student
          </label>
          <select
            className="form-input"
            value={selectedStudentId}
            onChange={e => setSelectedStudentId(e.target.value)}
            style={{ marginBottom: 12 }}
          >
            <option value="">Choose a student...</option>
            {filteredStudents.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.id})
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 500 }}>
            Block From Class
          </label>
          <select
            className="form-input"
            value={selectedClassIndex}
            onChange={e => setSelectedClassIndex(e.target.value)}
          >
            <option value="">Choose a class...</option>
            {teachers.map((t, i) => (
              <option key={i} value={i}>
                {t.name || `Class ${i + 1}`}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-primary btn-sm"
            disabled={!selectedStudentId || selectedClassIndex === ''}
            onClick={handleAdd}
          >
            Add Constraint
          </button>
        </div>
      </div>
    </>
  );
}
