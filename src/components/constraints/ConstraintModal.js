/**
 * ConstraintModal - Main constraint management modal
 *
 * Uses contexts:
 * - useStudents: For students and constraint data
 * - useAppState: teachers/classes
 *
 * @param {Object} props
 * @param {Function} props.onClose - Close callback
 */
function ConstraintModal({ onClose }) {
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
  const { teachers } = useAppStateExport();

  const totalConstraints = keepApart.length + keepTogether.length + keepOutOfClass.length;

  function handleTabChange(tab) {
    setActiveTab(tab);
  }

  const tabs = [
    { id: 'apart', label: 'Keep Apart', count: keepApart.length, color: 'var(--danger)' },
    { id: 'together', label: 'Keep Together', count: keepTogether.length, color: 'var(--accent)' },
    { id: 'outofclass', label: 'Keep Out of Class', count: keepOutOfClass.length, color: 'var(--warning)' },
  ];

  const title = (
    <span>Student Constraints {totalConstraints > 0 && <span style={{ color: 'var(--text2)', fontWeight: 400 }}>({totalConstraints})</span>}</span>
  );

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={title}
      size="lg"
      style={{ width: '90%' }}
    >
      <div style={{ margin: '-16px -24px' }}>
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
    </Modal>
  );
}
