/**
 * PrintReportView - Print-optimized class list report layout.
 *
 * Reads from existing contexts and renders:
 *   Page 1: Summary + class tables with aggregate stats + assessment
 *   Page 2: Constraints (optional, separate page for easy exclusion)
 * Hidden on screen by CSS; shown only in @media print.
 */
function PrintReportView() {
  const { students, assignment, locked, keepApart, keepTogether, keepOutOfClass, assessment } =
    useStudentsExport();
  const { numericCriteria, flagCriteria } = useCriteriaExport();
  const { teachers } = useAppStateExport();

  const reportData = useMemo(
    () =>
      buildPrintReportData(
        students,
        assignment,
        locked,
        keepApart,
        keepTogether,
        keepOutOfClass,
        teachers,
        numericCriteria,
        flagCriteria
      ),
    [
      students,
      assignment,
      locked,
      keepApart,
      keepTogether,
      keepOutOfClass,
      teachers,
      numericCriteria,
      flagCriteria,
    ]
  );

  const { generatedAt, totalStudents, totalAssigned, numClasses, classPages, constraintSummary } =
    reportData;
  const hasConstraints =
    constraintSummary.keepTogether.length > 0 ||
    constraintSummary.keepApart.length > 0 ||
    constraintSummary.keepOutOfClass.length > 0;

  // Compute aggregate stats for summary rows
  const aggregateStats = useMemo(() => {
    if (!classPages.length) return null;

    const numericAgg = numericCriteria.map(c => {
      const values = classPages.map(p => {
        const stat = p.numericStats.find(s => s.key === c.key);
        return stat ? stat.avg : 0;
      });
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      return { key: c.key, label: c.label, mean: Math.round(mean * 10) / 10 };
    });

    const flagAgg = flagCriteria.map(c => {
      const values = classPages.map(p => {
        const stat = p.flagStats.find(s => s.key === c.key);
        return stat ? stat.count / p.studentCount : 0;
      });
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      return { key: c.key, label: c.label, mean: Math.round(mean * 100) / 100 };
    });

    return { numericAgg, flagAgg };
  }, [classPages, numericCriteria, flagCriteria]);

  // Portal to <body> so #print-report is a sibling of #root, not a deep
  // descendant. The print CSS hides body's other children with display:none;
  // that idiom only works when the report is a top-level body child, and it
  // preserves normal block flow so page-break-after on each .print-page fires.
  return ReactDOM.createPortal(
    <div id="print-report" className="print-report">
      {/* Page 1: Summary + Assessment + Class Tables */}
      <div className="print-page print-summary-page">
        <h1>Class List Report</h1>
        <p className="print-summary-date">Generated: {generatedAt}</p>
        <div className="print-summary-stats">
          <div className="print-stat-badge">
            <strong>Total Students:</strong> {totalStudents}
          </div>
          <div className="print-stat-badge">
            <strong>Assigned:</strong> {totalAssigned}
          </div>
          <div className="print-stat-badge">
            <strong>Classes:</strong> {numClasses}
          </div>
        </div>

        {/* Assessment Section */}
        {assessment && assessment.ready && (
          <>
            <h3 className="print-section-heading">Balance Assessment</h3>
            <div style={{ marginBottom: 16, padding: 12, background: '#f8f9fa', borderRadius: 4 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 36, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
                  {assessment.score}
                </span>
                <span style={{ fontSize: 14, color: '#666' }}>out of 100</span>
              </div>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #ddd' }}>
                    <th style={{ textAlign: 'left', padding: '4px 0' }}>Scenario</th>
                    <th style={{ textAlign: 'right', padding: '4px 0' }}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '4px 0' }}>Current Assignment</td>
                    <td style={{ textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                      {assessment.currentCost.toFixed(3)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 0', color: '#1a7a5e' }}>Balanced (Optimal)</td>
                    <td style={{ textAlign: 'right', fontFamily: "'DM Mono', monospace", color: '#1a7a5e' }}>
                      {assessment.balancedCost.toFixed(3)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 0', color: '#dc2626' }}>Random</td>
                    <td style={{ textAlign: 'right', fontFamily: "'DM Mono', monospace", color: '#dc2626' }}>
                      {assessment.randomCost.toFixed(3)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}

        <h3 className="print-section-heading">Class Overview</h3>
        <table className="print-student-table print-overview-table">
          <thead>
            <tr>
              <th>Class</th>
              <th>Students</th>
              <th>M</th>
              <th>F</th>
              {classPages[0]?.uCount !== undefined &&
                classPages.some(p => p.uCount > 0) && <th>U</th>}
              {numericCriteria.map(c => (
                <th key={c.key}>{c.label}</th>
              ))}
              {flagCriteria.map(c => (
                <th key={c.key}>{c.label}</th>
              ))}
              {flagCriteria.length > 0 && <th>Total Flags</th>}
            </tr>
          </thead>
          <tbody>
            {classPages.map(page => (
              <tr key={page.classIndex}>
                <td><strong>{page.teacherName}</strong></td>
                <td>{page.studentCount}</td>
                <td>{page.mCount}</td>
                <td>{page.fCount}</td>
                {classPages.some(p => p.uCount > 0) && <td>{page.uCount}</td>}
                {page.numericStats.map(s => (
                  <td key={s.key}>{s.avg}</td>
                ))}
                {page.flagStats.map(s => (
                  <td key={s.key}>{s.count}</td>
                ))}
                {flagCriteria.length > 0 && <td>{page.totalFlagsCount}</td>}
              </tr>
            ))}
            {/* Aggregate summary row */}
            {aggregateStats && (
              <tr style={{ borderTop: '2px solid #333', fontWeight: 600, background: '#f8f9fa' }}>
                <td><strong>Average</strong></td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                {classPages.some(p => p.uCount > 0) && <td>—</td>}
                {aggregateStats.numericAgg.map(s => (
                  <td key={s.key}>{s.mean}</td>
                ))}
                {aggregateStats.flagAgg.map(s => (
                  <td key={s.key}>{(s.mean * 100).toFixed(0)}%</td>
                ))}
                {flagCriteria.length > 0 && <td>—</td>}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* One page per class with aggregate summary */}
      {classPages.map(page => {
        const density =
          page.studentCount >= 26 ? 'print-page--ultra'
            : page.studentCount >= 19 ? 'print-page--dense'
            : '';
        return (
        <div className={`print-page ${density}`} key={page.classIndex}>
          <div className="print-page-header">
            <h2>{page.teacherName}</h2>
            <div className="print-page-meta">
              <span>
                Class {page.classIndex + 1} • {page.studentCount} students
              </span>
            </div>
          </div>

          <div className="print-page-stats">
            {page.numericStats.map(stat => (
              <div key={stat.key} className="print-stat-badge">
                {stat.label}: {stat.avg}
              </div>
            ))}
            {page.flagStats.map(stat => (
              <div
                key={stat.key}
                className="print-stat-badge"
                style={{ background: stat.colors.bg, color: stat.colors.fg }}
              >
                {stat.label}: {stat.count}
              </div>
            ))}
            {flagCriteria.length > 0 && (
              <div className="print-stat-badge">Total Flags: {page.totalFlagsCount}</div>
            )}
          </div>

          <table className="print-student-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Gender</th>
                {numericCriteria.map(c => (
                  <th key={c.key}>{c.label}</th>
                ))}
                {flagCriteria.map(c => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {page.studentRows.map(s => (
                <tr key={s.id}>
                  <td>{s.index}</td>
                  <td>{s.name}</td>
                  <td>
                    <span className={`badge badge-${s.gender || 'U'}`}>{s.gender || 'U'}</span>
                  </td>
                  {numericCriteria.map(c => (
                    <td key={c.key}>{s[c.key] ?? 0}</td>
                  ))}
                  {flagCriteria.map((c, idx) => (
                    <td key={c.key}>
                      {s[c.key] ? (
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: generateColor(c.key, idx, 'light').dot,
                            display: 'inline-block',
                          }}
                          title={c.label}
                        />
                      ) : (
                        <span style={{ display: 'inline-block', width: 8, height: 8 }} />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {/* Aggregate summary row */}
              <tr style={{ borderTop: '2px solid #333', fontWeight: 600, background: '#f8f9fa' }}>
                <td>—</td>
                <td><strong>Average</strong></td>
                <td>—</td>
                {page.numericStats.map(s => (
                  <td key={s.key}>{s.avg}</td>
                ))}
                {page.flagStats.map(s => (
                  <td key={s.key}>{page.studentCount > 0 ? (s.count / page.studentCount * 100).toFixed(0) + '%' : '0%'}</td>
                ))}
              </tr>
            </tbody>
          </table>

          <div className="print-page-footer">
            <span>
              <strong>{page.studentCount}</strong> students
            </span>
            <span>
              <strong>{page.mCount}</strong> Male
            </span>
            <span>
              <strong>{page.fCount}</strong> Female
            </span>
            {page.uCount > 0 && (
              <span>
                <strong>{page.uCount}</strong> Unspecified
              </span>
            )}
          </div>
        </div>
        );
      })}

      {/* Page 2: Constraints (separate page for easy exclusion) */}
      {hasConstraints && (
        <div className="print-page print-constraints-page">
          <h2>Constraints</h2>
          <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
            This page can be excluded from printing if desired.
          </p>
          <div className="print-constraints">
            {constraintSummary.keepTogether.length > 0 && (
              <div className="print-constraint-group">
                <h4>Keep Together</h4>
                <ul>
                  {constraintSummary.keepTogether.map((group, i) => (
                    <li key={i}>{group.join(', ')}</li>
                  ))}
                </ul>
              </div>
            )}
            {constraintSummary.keepApart.length > 0 && (
              <div className="print-constraint-group">
                <h4>Keep Apart</h4>
                <ul>
                  {constraintSummary.keepApart.map(([a, b], i) => (
                    <li key={i}>{a} ↔ {b}</li>
                  ))}
                </ul>
              </div>
            )}
            {constraintSummary.keepOutOfClass.length > 0 && (
              <div className="print-constraint-group">
                <h4>Keep Out of Class</h4>
                <ul>
                  {constraintSummary.keepOutOfClass.map((c, i) => (
                    <li key={i}>
                      {c.name} — not in {c.teacherName}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
