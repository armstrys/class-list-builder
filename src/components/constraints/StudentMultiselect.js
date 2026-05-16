/**
 * StudentMultiselect - Reusable multiselect student list component
 *
 * @param {Object} props
 * @param {Array} props.students - Filtered students to display
 * @param {Set} props.selectedIds - Currently selected student IDs
 * @param {Function} props.onToggle - Toggle selection callback
 * @param {Function} props.onSelectAll - Select all visible callback
 * @param {Function} props.onDeselectAll - Deselect all callback
 * @param {Set} props.disabledIds - IDs that should be shown as disabled
 */
function StudentMultiselect({
  students,
  selectedIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
  disabledIds,
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <label style={{ fontSize: 13, fontWeight: 500 }}>
          Select Students ({selectedIds.size} selected)
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onSelectAll}
            disabled={students.length === 0}
          >
            Select All
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onDeselectAll}
            disabled={selectedIds.size === 0}
          >
            Deselect All
          </button>
        </div>
      </div>
      <div
        style={{
          maxHeight: 200,
          overflowY: 'auto',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--surface)',
        }}
      >
        {students.length === 0 ? (
          <div
            style={{ padding: '12px', color: 'var(--text3)', fontSize: 13, textAlign: 'center' }}
          >
            No students match the filter
          </div>
        ) : (
          students.map(s => {
            const isSelected = selectedIds.has(s.id);
            const isDisabled = disabledIds.has(s.id);
            return (
              <label
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  background: isSelected
                    ? 'var(--accent-bg, rgba(59, 130, 246, 0.1))'
                    : 'transparent',
                  opacity: isDisabled ? 0.5 : 1,
                }}
                onClick={() => onToggle(s.id)}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13, flex: 1 }}>{s.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>
                  {s.id}
                </span>
                {isDisabled && (
                  <span
                    className="badge"
                    style={{ fontSize: 10, background: 'var(--warning)', color: 'white' }}
                  >
                    Already blocked
                  </span>
                )}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
