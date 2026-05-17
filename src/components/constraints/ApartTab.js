/**
 * ApartTab - Keep Apart constraint management
 * 
 * @param {Object} props
 * @param {Array} props.students - All students
 * @param {Array} props.keepApart - Current apart constraints
 * @param {Function} props.onAddKeepApart - Add constraint callback
 * @param {Function} props.onRemoveKeepApart - Remove constraint callback
 */
function ApartTab({ students, keepApart, onAddKeepApart, onRemoveKeepApart }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [filter, setFilter] = useState('');

  const studentById = Object.fromEntries(students.map(s => [s.id, s]));

  // Build adjacency list
  const apartAdj = {};
  students.forEach(s => { apartAdj[s.id] = []; });
  keepApart.forEach(([id1, id2]) => {
    if (apartAdj[id1]) apartAdj[id1].push(id2);
    if (apartAdj[id2]) apartAdj[id2].push(id1);
  });

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(filter.toLowerCase())
  );

  const apartConstraints = keepApart.map(([id1, id2]) => ({
    id1,
    id2,
    name1: studentById[id1]?.name || id1,
    name2: studentById[id2]?.name || id2,
  }));

  function toggleSelection(id) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function handleAdd() {
    if (selectedIds.length >= 2) {
      for (let i = 0; i < selectedIds.length; i++) {
        for (let j = i + 1; j < selectedIds.length; j++) {
          onAddKeepApart(selectedIds[i], selectedIds[j]);
        }
      }
      setSelectedIds([]);
    }
  }

  // Get related students info
  const selectedSet = new Set(selectedIds);
  const related = new Set();
  selectedIds.forEach(id => {
    apartAdj[id]?.forEach(neighbor => {
      if (!selectedSet.has(neighbor)) related.add(neighbor);
    });
  });

  return (
    <>
      {/* Existing Constraints */}
      <div style={{ marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 500 }}>
          Active Keep-Apart Constraints ({apartConstraints.length})
        </h4>
        {apartConstraints.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: 13, padding: '12px 0' }}>
            No keep-apart constraints set yet. These students will be placed in different classes.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {apartConstraints.map((c, idx) => (
              <div key={idx} className="constraint-item" style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
                    {c.name1}
                  </span>
                  <span style={{ color: 'var(--text3)' }}>↔</span>
                  <span className="badge" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
                    {c.name2}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>
                    {apartAdj[c.id1].length > 1 && `${apartAdj[c.id1].length - 1} other constraints`}
                  </span>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => onRemoveKeepApart(c.id1, c.id2)}
                    title="Remove this constraint"
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
          Add Keep-Apart Constraint
        </h4>
        <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--text3)' }}>
          Select 2+ students. Each pair will be kept in different classes.
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
                {apartAdj[s.id]?.length > 0 && (
                  <span style={{ fontSize: 10, marginLeft: 8, opacity: 0.7 }}>
                    ({apartAdj[s.id].length} apart constraints)
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
            {selectedIds.length >= 2 && related.size > 0 && (
              <div style={{ fontSize: 12, color: 'var(--warning)' }}>
                Note: {Array.from(related).map(id => studentById[id]?.name).join(', ')} 
                {' '}already have apart constraints with selected students
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
            Add {selectedIds.length >= 2 ? `${(selectedIds.length * (selectedIds.length - 1)) / 2} Constraints` : 'Constraints'}
          </button>
        </div>
      </div>
    </>
  );
}
