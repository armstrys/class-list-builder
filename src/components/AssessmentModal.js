/**
 * AssessmentModal - Display assessment results with baselines and class statistics.
 *
 * @param {Object} props
 * @param {Function} props.onClose - Close modal callback
 * @param {Object} props.assessment - Assessment result data
 * @param {boolean} props.isAssessing - Whether assessment is running
 */
function AssessmentModal({ onClose, assessment, isAssessing }) {
  const { numericCriteria, flagCriteria } = useCriteriaExport();
  const { teachers } = useAppStateExport();

  if (isAssessing) {
    return (
      <Modal onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
          <h3>Running Assessment...</h3>
          <p style={{ color: 'var(--text3)', fontSize: 14 }}>
            Comparing current assignment against balanced and random baselines.
          </p>
        </div>
      </Modal>
    );
  }

  if (!assessment || !assessment.ready) {
    return (
      <Modal onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>📊</div>
          <h3>No Assessment Available</h3>
          <p style={{ color: 'var(--text3)', fontSize: 14 }}>
            Run the optimizer or make assignments to generate an assessment.
          </p>
        </div>
      </Modal>
    );
  }

  const { score, currentCost, balancedCost, randomCost, classStats } = assessment;

  // Score color coding
  const scoreColor = score >= 80 ? 'var(--accent)' : score >= 50 ? 'var(--amber)' : 'var(--danger)';

  return (
    <Modal onClose={onClose} isOpen={true} title="Class Balance Assessment" size="lg">
      <div style={{ maxWidth: 720, maxHeight: '80vh', overflow: 'auto' }}>
        <h2 style={{ marginBottom: 4 }}>Class Balance Assessment</h2>
        <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 20 }}>
          Understanding your class list quality score.
        </p>

        {/* Quality Score Display */}
        <div
          style={{
            textAlign: 'center',
            padding: '24px 20px',
            background: 'var(--surface2)',
            borderRadius: 'var(--radius)',
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 8 }}>
            Quality Score
          </div>
          <div
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: scoreColor,
              lineHeight: 1,
              fontFamily: "'DM Mono', monospace",
            }}
          >
            {score}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text2)', marginTop: 8 }}>
            out of 100
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 12, maxWidth: 400, margin: '12px auto 0' }}>
            {score >= 80
              ? 'Excellent balance — classes are well-distributed across all criteria.'
              : score >= 50
              ? 'Good balance — some criteria show moderate variation between classes.'
              : 'Fair balance — significant variation detected. Consider adjusting constraints or re-optimizing.'}
          </div>
        </div>

        {/* What This Means */}
        <div
          style={{
            padding: 16,
            background: 'var(--surface2)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 24,
            fontSize: 13,
            lineHeight: 1.6,
            color: 'var(--text2)',
          }}
        >
          <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: 'var(--text1)' }}>How the Quality Score Works</h4>
          <p style={{ margin: '0 0 8px 0' }}>
            The Quality Score measures how well your current class assignments are balanced compared to two extremes:
          </p>
          <ul style={{ margin: '0 0 8px 0', paddingLeft: 20 }}>
            <li><strong>Balanced (Optimal)</strong>: The best possible balance if there were no constraints at all.</li>
            <li><strong>Random</strong>: The average balance from completely random assignments.</li>
          </ul>
          <p style={{ margin: 0 }}>
            A score of <strong>100</strong> means your classes are as balanced as theoretically possible. 
            A score of <strong>0</strong> means no better than random. 
            The score is sensitive to small deviations — even a slight imbalance causes a noticeable drop.
          </p>
        </div>

        {/* Baseline Comparison */}
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Baseline Comparison</h3>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
            marginBottom: 24,
          }}
        >
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--text3)', fontWeight: 600 }}>
                Scenario
              </th>
              <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--text3)', fontWeight: 600 }}>
                Cost
              </th>
              <th style={{ textAlign: 'left', padding: '8px 0 8px 16px', color: 'var(--text3)', fontWeight: 600 }}>
                Description
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '10px 0', fontWeight: 500 }}>Current Assignment</td>
              <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                {currentCost.toFixed(5)}
              </td>
              <td style={{ padding: '10px 0 10px 16px', color: 'var(--text2)', fontSize: 12 }}>
                Your current class assignments with all constraints applied.
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '10px 0', fontWeight: 500, color: 'var(--accent)' }}>
                Balanced (Optimal)
              </td>
              <td
                style={{
                  padding: '10px 0',
                  textAlign: 'right',
                  fontFamily: "'DM Mono', monospace",
                  color: 'var(--accent)',
                }}
              >
                {balancedCost.toFixed(5)}
              </td>
              <td style={{ padding: '10px 0 10px 16px', color: 'var(--text2)', fontSize: 12 }}>
                Theoretical best with no constraints — the ceiling.
              </td>
            </tr>
            <tr>
              <td style={{ padding: '10px 0', fontWeight: 500, color: 'var(--danger)' }}>
                Random
              </td>
              <td
                style={{
                  padding: '10px 0',
                  textAlign: 'right',
                  fontFamily: "'DM Mono', monospace",
                  color: 'var(--danger)',
                }}
              >
                {randomCost.toFixed(5)}
              </td>
              <td style={{ padding: '10px 0 10px 16px', color: 'var(--text2)', fontSize: 12 }}>
                Average of random assignments — the floor.
              </td>
            </tr>
          </tbody>
        </table>

        {/* Per-Class Statistics */}
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Per-Class Statistics</h3>
        {classStats.map(cls => (
          <div
            key={cls.classIndex}
            style={{
              marginBottom: 16,
              padding: 12,
              background: 'var(--surface2)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: 14,
                marginBottom: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>
                {teachers[cls.classIndex]?.name || `Class ${cls.classIndex + 1}`}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>
                {cls.studentCount} students · {cls.mCount}M · {cls.fCount}F
                {cls.uCount > 0 && ` · ${cls.uCount}U`}
              </span>
            </div>

            {numericCriteria.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  Averages
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {cls.numericStats.map(stat => (
                    <span
                      key={stat.key}
                      style={{
                        fontSize: 12,
                        fontFamily: "'DM Mono', monospace",
                        background: 'var(--surface)',
                        padding: '3px 8px',
                        borderRadius: 4,
                      }}
                    >
                      {stat.label}: {stat.mean}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {flagCriteria.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  Flag Rates
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {cls.flagStats.map(stat => (
                    <span
                      key={stat.key}
                      style={{
                        fontSize: 12,
                        fontFamily: "'DM Mono', monospace",
                        background: 'var(--surface)',
                        padding: '3px 8px',
                        borderRadius: 4,
                      }}
                    >
                      {stat.label}: {(stat.mean * 100).toFixed(0)}%
                    </span>
                  ))}
                  {cls.totalFlags > 0 && (
                    <span
                      style={{
                        fontSize: 12,
                        fontFamily: "'DM Mono', monospace",
                        background: 'var(--surface)',
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontWeight: 500,
                      }}
                    >
                      Total Flags: {cls.totalFlags}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
