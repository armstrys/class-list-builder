/**
 * TogetherTab - Keep Together constraint management
 * 
 * @param {Object} props
 * @param {Array} props.students - All students
 * @param {Array} props.keepTogether - Current together groups
 * @param {Function} props.onAddKeepTogether - Add group callback
 * @param {Function} props.onRemoveKeepTogether - Remove group callback
 */
function TogetherTab({ students, keepTogether, onAddKeepTogether, onRemoveKeepTogether }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [filter, setFilter] = useState('');

  const studentById = Object.fromEntries(students.map(s => [s.id, s]));

  // Build set of students already in groups
  const togetherStudentSet = new Set();
  keepTogether.forEach(group => {
    group.forEach(id => togetherStudentSet.add(id));
  });

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(filter.toLowerCase())
  );

  const togetherConstraints = keepTogether.map((group, idx) => ({
    idx,
    studentIds: group,
    names: group.map(id => studentById[id]?.name || id),
  }));

  function toggleSelection(id) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function handleAdd() {
    if (selectedIds.length >= 2) {
      onAddKeepTogether(selectedIds);
      setSelectedIds([]);
    }
  }

  return (
    <>
      {/* Existing Groups */}
      <div style={{ marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 500 }}>
          Active Keep-Together Groups ({togetherConstraints.length})
        </h4>
        {togetherConstraints.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: 13, padding: '12px 0' }}>
            No keep-together groups set yet. Selected students will be placed in the same class.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {togetherConstraints.map((c) => (
              <div key={c.idx} className="constraint-item" style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500, marginRight: 8 }}>
                    Group {c.idx + 1}:
                  </span>
                  {c.names.map((name, i) => (
                    <span key={i}>
                      <span className="badge" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
                        {name}
                      </span>
                      {i < c.names.length - 1 && (
                        <span style={{ color: 'var(--text3)', margin: '0 4px' }}>+</span>
                      )}
                    </span>
                  ))}
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => onRemoveKeepTogether(c.idx)}
                    title="Remove this group"
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
          Add Keep-Together Group
        </h4>
        <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--text3)' }}>
          Select 2+ students. They will be placed in the same class.
        </p>

        <input
          type="text"
          className="form-input"
          placeholder="Filter students by name..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ marginBottom: 12 }}
        />

        <div style={{
          maxHeight: 200,
          overflow: 'auto',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: 12,
        }}>
          {filteredStudents.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--text3)', textAlign: 'center' }}>
              No students match your filter.
            </div>
          ) : (
            filteredStudents.map(s => (
              <div
                key={s.id}
                onClick={() => toggleSelection(s.id)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  background: selectedIds.includes(s.id) ? 'var(--accent)' : 'transparent',
                  color: selectedIds.includes(s.id) ? 'white' : 'var(--text)',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(s.id)}
                  onChange={() => {}}
                  style={{ pointerEvents: 'none' }}
                />
                <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace', minWidth: 60 }}>{s.id}</span>
                <span>{s.name}</span>
                {togetherStudentSet.has(s.id) && (
                  <span style={{ fontSize: 10, marginLeft: 8, opacity: 0.7, color: 'var(--accent)' }}>
                    (in group)
                  </span>
                )}
                <span className={`badge badge-${s.gender}`} style={{ marginLeft: 'auto' }}>
                  {s.gender}
                </span>
              </div>
            ))
          )}
        </div>

        {selectedIds.length > 0 && (
          <div style={{
            marginBottom: 12,
            padding: 12,
            background: 'var(--surface)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)'
          }}>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              <strong>Selected ({selectedIds.length}):</strong>{' '}
              {selectedIds.map(id => studentById[id]?.name).join(', ')}
            </div>
            {selectedIds.length >= 2 && (
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                Will create 1 keep-together group
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end' }}>
          {selectedIds.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds([])}>
              Clear Selection
            </button>
          )}
          <button
            className="btn btn-primary btn-sm"
            disabled={selectedIds.length < 2}
            onClick={handleAdd}
          >
            Add Group
          </button>
        </div>
      </div>
    </>
  );
}
