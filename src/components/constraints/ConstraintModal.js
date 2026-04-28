/**
 * ConstraintModal - Main constraint management modal
 * 
 * Uses contexts:
 * - useStudents: For students and constraint data
 * 
 * @param {Object} props
 * @param {Array<{id: string, name: string}>} props.teachers - Class/teacher definitions
 * @param {Function} props.onClose - Close callback
 */
function ConstraintModal({ teachers, onClose }) {
  const [activeTab, setActiveTab] = useState('apart');

  const {
    students,
    keepApart,
    keepTogether,
    keepOutOfClass,
    addKeepApart,
    removeKeepApart,
    addKeepTogether,
    removeKeepTogether,
    addKeepOutOfClass,
    removeKeepOutOfClass,
  } = useStudentsExport();

  const totalConstraints = keepApart.length + keepTogether.length + keepOutOfClass.length;

  function handleTabChange(tab) {
    setActiveTab(tab);
  }

  const tabs = [
    { id: 'apart', label: 'Keep Apart', count: keepApart.length, color: 'var(--danger)' },
    { id: 'together', label: 'Keep Together', count: keepTogether.length, color: 'var(--accent)' },
    { id: 'outofclass', label: 'Keep Out of Class', count: keepOutOfClass.length, color: 'var(--warning)' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, width: '90%' }}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Student Constraints {totalConstraints > 0 && `(${totalConstraints})`}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ padding: 0 }}>
          {/* Tabs */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
          }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                style={{
                  padding: '12px 20px',
                  border: 'none',
                  background: activeTab === tab.id ? 'var(--bg)' : 'transparent',
                  borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                  color: activeTab === tab.id ? 'var(--accent)' : 'var(--text2)',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="badge" style={{ background: tab.color, color: 'white', fontSize: 10 }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div style={{ padding: 20 }}>
            {activeTab === 'apart' && (
              <ApartTab
                students={students}
                keepApart={keepApart}
                onAddKeepApart={addKeepApart}
                onRemoveKeepApart={removeKeepApart}
              />
            )}
            {activeTab === 'together' && (
              <TogetherTab
                students={students}
                keepTogether={keepTogether}
                onAddKeepTogether={addKeepTogether}
                onRemoveKeepTogether={removeKeepTogether}
              />
            )}
            {activeTab === 'outofclass' && (
              <OutOfClassTab
                students={students}
                teachers={teachers}
                keepOutOfClass={keepOutOfClass}
                onAddKeepOutOfClass={addKeepOutOfClass}
                onRemoveKeepOutOfClass={removeKeepOutOfClass}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
