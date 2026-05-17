/**
 * ClassFilterDropdown - Filter dropdown for showing/hiding classes
 *
 * Provides a dropdown interface to toggle visibility of individual classes
 * and search for students to quickly find their class.
 *
 * @param {Object} props
 * @param {Set<number>} props.visibleClasses - Set of visible class indices
 * @param {Function} props.setVisibleClasses - Update visible classes
 * @param {boolean} props.showClassFilter - Whether dropdown is open
 * @param {Function} props.setShowClassFilter - Toggle dropdown visibility
 * @param {Array<Object>} props.students - All student objects
 * @param {Object<string, number>} props.assignment - Student ID to class index mapping
 */
function ClassFilterDropdown({
  visibleClasses,
  setVisibleClasses,
  showClassFilter,
  setShowClassFilter,
  students,
  assignment,
}) {
  const { teachers } = useAppStateExport();
  const dropdownRef = useRef(null);
  const selectedCount = visibleClasses.size;
  const totalCount = teachers.length;
  const [studentFilter, setStudentFilter] = useState('');

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowClassFilter(false);
      }
    }
    if (showClassFilter) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showClassFilter, setShowClassFilter]);

  function toggleClass(classIdx) {
    setVisibleClasses(prev => {
      const next = new Set(prev);
      if (next.has(classIdx)) {
        next.delete(classIdx);
      } else {
        next.add(classIdx);
      }
      return next;
    });
  }

  function selectAll() {
    setVisibleClasses(new Set(teachers.map((_, i) => i)));
  }

  function clearAll() {
    setVisibleClasses(new Set());
  }

  // Find which class a student is in
  function getStudentClass(student) {
    const classIdx = assignment[student.id];
    if (classIdx === undefined) return null;
    return { index: classIdx, name: teachers[classIdx]?.name || `Class ${classIdx + 1}` };
  }

  // Filter students by name or ID
  const filteredStudents = studentFilter.trim() 
    ? students.filter(s => 
        s.name.toLowerCase().includes(studentFilter.toLowerCase()) ||
        s.id.toLowerCase().includes(studentFilter.toLowerCase())
      )
    : [];

  // Show class for a found student
  function showStudentClass(student) {
    const classInfo = getStudentClass(student);
    if (classInfo) {
      setVisibleClasses(new Set([classInfo.index]));
      setStudentFilter('');
      setShowClassFilter(false);
    }
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => setShowClassFilter(!showClassFilter)}
        title="Filter which classes to show"
      >
        👁️ Show Classes ({selectedCount}/{totalCount})
      </button>
      
      {showClassFilter && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow)',
            zIndex: 1000,
            minWidth: 220,
            maxWidth: 300,
            maxHeight: '60vh',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <button
              className="btn btn-ghost btn-sm"
              onClick={selectAll}
              style={{ fontSize: 11, padding: '3px 8px' }}
            >
              Select All
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={clearAll}
              style={{ fontSize: 11, padding: '3px 8px' }}
            >
              Clear All
            </button>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 11,
                color: 'var(--text3)',
              }}
            >
              {selectedCount} selected
            </span>
          </div>
          
          {/* Student search section */}
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface2)',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 500 }}>
              Find Student
            </div>
            <input
              type="text"
              placeholder="Name or ID..."
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                fontFamily: 'inherit',
                background: 'var(--surface)',
                color: 'var(--text)',
                outline: 'none',
              }}
            />
            {filteredStudents.length > 0 && (
              <div style={{ marginTop: 8, maxHeight: 120, overflowY: 'auto' }}>
                {filteredStudents.slice(0, 5).map(student => {
                  const classInfo = getStudentClass(student);
                  return (
                    <div
                      key={student.id}
                      onClick={() => showStudentClass(student)}
                      style={{
                        padding: '6px 8px',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--surface)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {student.name}
                      </span>
                      {classInfo && (
                        <span style={{ fontSize: 10, color: 'var(--accent)', whiteSpace: 'nowrap', marginLeft: 8 }}>
                          {classInfo.name}
                        </span>
                      )}
                    </div>
                  );
                })}
                {filteredStudents.length > 5 && (
                  <div style={{ fontSize: 10, color: 'var(--text3)', padding: '4px 8px', fontStyle: 'italic' }}>
                    ...and {filteredStudents.length - 5} more
                  </div>
                )}
              </div>
            )}
            {studentFilter.trim() && filteredStudents.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, fontStyle: 'italic' }}>
                No students found
              </div>
            )}
          </div>
          
          <div
            style={{
              overflowY: 'auto',
              padding: '6px 0',
              maxHeight: '40vh',
            }}
          >
            {teachers.map((teacher, i) => (
              <label
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                  fontSize: 13,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surface2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <input
                  type="checkbox"
                  checked={visibleClasses.has(i)}
                  onChange={() => toggleClass(i)}
                  style={{ cursor: 'pointer' }}
                />
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={teacher?.name || `Class ${i + 1}`}
                >
                  {teacher?.name || `Class ${i + 1}`}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--text3)',
                    background: 'var(--surface2)',
                    padding: '1px 5px',
                    borderRadius: 4,
                  }}
                >
                  #{i + 1}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
