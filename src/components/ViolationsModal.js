/**
 * ViolationsModal - Display constraint violations in detail
 *
 * Shows which keep-apart, keep-together, and keep-out-of-class constraints
 * are violated in the current assignment.
 *
 * @param {Object} props
 * @param {Array<[string, string]>} props.apartViolations - Pairs of students who should be apart but aren't
 * @param {Array<string[]>} props.togetherViolations - Groups that should be together but are split
 * @param {Array<{studentId: string, classIndex: number}>} props.outOfClassViolations - Students in forbidden classes
 * @param {Array<Object>} props.students - All student objects
 * @param {Object<string, number>} props.assignment - Student ID to class index mapping
 * @param {Function} props.onClose - Close callback
 * @param {Function} props.onOpenConstraints - Open constraints editor callback
 */
function ViolationsModal({
  apartViolations,
  togetherViolations,
  outOfClassViolations,
  students,
  assignment,
  onClose,
  onOpenConstraints,
}) {
  const { teachers } = useAppStateExport();
  const studentById = Object.fromEntries(students.map(s => [s.id, s]));

  // Get class name for a student
  function getClassName(studentId) {
    const classIdx = assignment[studentId];
    if (classIdx === undefined) return 'Unassigned';
    return teachers[classIdx]?.name || `Class ${classIdx + 1}`;
  }

  const hasApart = apartViolations.length > 0;
  const hasTogether = togetherViolations.length > 0;
  const hasOutOfClass = outOfClassViolations.length > 0;

  const footer = (
    <>
      <button className="btn btn-secondary" onClick={onClose}>Close</button>
      <button className="btn btn-primary" onClick={onOpenConstraints}>
        Edit Constraints
      </button>
    </>
  );

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Constraint Violations"
      size="lg"
      footer={footer}
    >
      {/* Explanation */}
      <div style={{
        padding: 12,
        background: 'var(--surface)',
        borderRadius: 'var(--radius-sm)',
        marginBottom: 20,
        fontSize: 13,
        color: 'var(--text2)',
        border: '1px solid var(--border)',
      }}>
        <strong>Why are constraints violated?</strong>
        <p style={{ margin: '8px 0 0 0' }}>
          The optimizer tries to balance all criteria while respecting your constraints. 
          Sometimes constraints conflict with each other or make class balance impossible. 
          Consider removing some constraints or manually adjusting the results.
        </p>
      </div>

      {/* Keep Apart Violations */}
      {hasApart && (
        <div style={{ marginBottom: 24 }}>
          <h4 style={{
            margin: '0 0 12px 0',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span>🚫</span>
            Keep-Apart Violations ({apartViolations.length})
          </h4>
          <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--text3)' }}>
            These students should be in different classes but ended up together:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {apartViolations.map(([id1, id2], idx) => (
              <div key={idx} style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge" style={{ background: 'var(--surface)', color: 'var(--text)' }}>
                    {studentById[id1]?.name || id1}
                  </span>
                  <span style={{ color: 'var(--text3)' }}>↔</span>
                  <span className="badge" style={{ background: 'var(--surface)', color: 'var(--text)' }}>
                    {studentById[id2]?.name || id2}
                  </span>
                </div>
                <span style={{
                  marginLeft: 'auto',
                  fontSize: 11,
                  color: 'var(--danger)',
                  fontWeight: 500,
                }}>
                  Both in: {getClassName(id1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Keep Together Violations */}
      {hasTogether && (
        <div style={{ marginBottom: 24 }}>
          <h4 style={{
            margin: '0 0 12px 0',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span>🔗</span>
            Keep-Together Violations ({togetherViolations.length})
          </h4>
          <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--text3)' }}>
            These students should be in the same class but were split up:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {togetherViolations.map((group, idx) => {
              const classDistribution = {};
              group.forEach(id => {
                const className = getClassName(id);
                if (!classDistribution[className]) classDistribution[className] = [];
                classDistribution[className].push(studentById[id]?.name || id);
              });

              return (
                <div key={idx} style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                }}>
                  <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text3)' }}>
                    Group {idx + 1}:
                  </div>
                  {Object.entries(classDistribution).map(([className, names]) => (
                    <div key={className} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 4,
                      flexWrap: 'wrap',
                    }}>
                      <span style={{
                        fontSize: 11,
                        color: 'var(--danger)',
                        fontWeight: 500,
                        minWidth: 80,
                      }}>
                        {className}:
                      </span>
                      <span style={{ fontSize: 13 }}>
                        {names.join(', ')}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Keep Out of Class Violations */}
      {hasOutOfClass && (
        <div style={{ marginBottom: 24 }}>
          <h4 style={{
            margin: '0 0 12px 0',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span>🚫</span>
            Keep-Out-of-Class Violations ({outOfClassViolations.length})
          </h4>
          <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--text3)' }}>
            These students should not be in their assigned class:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {outOfClassViolations.map(({ studentId, classIndex }, idx) => (
              <div key={idx} style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge" style={{ background: 'var(--surface)', color: 'var(--text)' }}>
                    {studentById[studentId]?.name || studentId}
                  </span>
                  <span style={{ color: 'var(--text3)' }}>→</span>
                  <span className="badge" style={{ background: 'var(--warning)', color: 'white' }}>
                    {teachers[classIndex]?.name || `Class ${classIndex + 1}`}
                  </span>
                </div>
                <span style={{
                  marginLeft: 'auto',
                  fontSize: 11,
                  color: 'var(--danger)',
                  fontWeight: 500,
                }}>
                  Should be excluded
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      <div style={{
        padding: 12,
        background: 'var(--surface)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
      }}>
        <h5 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 500 }}>
          What can you do?
        </h5>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text2)' }}>
          <li>Click "Edit Constraints" below to remove conflicting constraints</li>
          <li>Try re-optimizing with fewer constraints</li>
          <li>Manually drag students to fix violations (locked students stay in place)</li>
          <li>Consider if some constraints are truly necessary</li>
        </ul>
      </div>
    </Modal>
  );
}
