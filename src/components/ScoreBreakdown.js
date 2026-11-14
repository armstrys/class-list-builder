/**
 * ScoreBreakdown - Ranked list of what is driving the current balance cost.
 *
 * Answers the question the score alone cannot: "why this number?". One row per
 * non-zero cost term, sorted largest first, each with a share bar and its
 * percentage of the total cost. Percentages are derived from the terms that the
 * assessment summed, so they always add up to the cost the modal reports. A zero
 * total is guarded rather than divided by.
 *
 * Inert terms (cost exactly 0) are hidden, since a row saying "0%" explains
 * nothing. If every term is inert the list says so in one sentence.
 *
 * @param {Object} props
 * @param {Array<{id: string, label: string, kind: 'balance'|'penalty', cost: number}>} props.terms
 *   Itemised cost from `computeCostTerms` (carried on the assessment result).
 */
function ScoreBreakdown({ terms }) {
  const rankedTerms = rankCostTerms(terms);

  if (rankedTerms.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24 }}>
        Every term is zero — this assignment is balanced as far as the model can measure.
      </p>
    );
  }

  return (
    <div
      style={{
        padding: 16,
        background: 'var(--surface2)',
        borderRadius: 'var(--radius-sm)',
        marginBottom: 24,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rankedTerms.map(term => {
          const percent = term.percent;
          const isPenalty = term.kind === 'penalty';
          return (
            <div key={term.id}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 12,
                  fontSize: 13,
                  marginBottom: 4,
                }}
              >
                <span style={{ color: 'var(--text1)' }}>
                  {term.label}
                  {isPenalty && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 10,
                        textTransform: 'uppercase',
                        letterSpacing: '.5px',
                        color: 'var(--danger)',
                      }}
                    >
                      penalty
                    </span>
                  )}
                </span>
                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 12,
                    color: 'var(--text2)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {percent}%
                </span>
              </div>
              {/* The bar restates the percentage for the eye only; the label and
                  number beside it carry the meaning, so it is not announced. */}
              <div
                aria-hidden="true"
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: 'var(--surface)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.max(2, percent)}%`,
                    height: '100%',
                    borderRadius: 3,
                    background: isPenalty ? 'var(--danger)' : 'var(--accent)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ margin: '12px 0 0 0', fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
        Each percentage is that term's share of the current total cost. A penalty line means a
        constraint is being violated, which usually outweighs everything else.
      </p>
    </div>
  );
}
