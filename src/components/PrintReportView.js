/**
 * PrintReportView - Print-optimized class list report layout.
 *
 * Reads from existing contexts and renders one page per class.
 * Hidden on screen by CSS; shown only in @media print.
 */
function PrintReportView() {
  const { students, assignment, locked, keepApart, keepTogether, keepOutOfClass } =
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

  const { generatedAt, totalStudents, totalAssigned, numClasses, classPages } = reportData;

  return (
    <div id="print-report" className="print-report">
      {/* Summary / cover page */}
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
      </div>

      {/* One page per class */}
      {classPages.map(page => (
        <div className="print-page" key={page.classIndex}>
          <div className="print-page-header">
            <h2>{page.teacherName}</h2>
            <div className="print-page-meta">
              <span>
                Class {page.classIndex + 1} • {page.studentCount} students
              </span>
              <span>
                Gender: {page.mCount} M / {page.fCount} F / {page.uCount} U
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
                  <td>
                    {s.name}
                    {s.isLocked ? ' 🔒' : ''}
                    {s.hasConstraints ? ' 🔗' : ''}
                  </td>
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
                            background: generateColor(c.key, idx).dot,
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
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
