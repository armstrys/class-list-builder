/**
 * WelcomeModal - Privacy splash screen for GitHub Pages visitors
 *
 * Displays on first visit to GitHub Pages to explain:
 * - Privacy: Data stays on your computer
 * - Features: What the tool does
 * - Documentation: Link to README
 *
 * Shows once per browser, then stays out of the way. The same gate applies to
 * the hosted build and the downloaded standalone file, so there is no build
 * flag to inject and the two artifacts behave identically.
 *
 * @param {Object} props
 * @param {Function} props.onClose - Close callback
 * @param {Function} props.onLoadDemo - Callback to load demo/sample data
 */
const WELCOME_SEEN_KEY = 'clb-welcome-seen';

function WelcomeModal({ onClose, onLoadDemo }) {
  const [isVisible, setIsVisible] = React.useState(false);
  // Cancelling asks first: the demo is the fastest way in, and a one-click
  // skip on the first screen is how someone dismisses it without ever seeing it.
  const [confirmSkip, setConfirmSkip] = React.useState(false);

  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    // welcome=1 reopens it (handy in dev); skipwelcome=1 never shows it.
    const forceWelcome = urlParams.get('welcome') === '1';
    const skipWelcome = urlParams.get('skipwelcome') === '1';

    let seen = false;
    try {
      seen = localStorage.getItem(WELCOME_SEEN_KEY) === '1';
    } catch {
      // localStorage may be unavailable (private mode, sandboxed iframe).
      // Showing the splash every time is the safer failure here.
    }

    if (!skipWelcome && (forceWelcome || !seen)) setIsVisible(true);
  }, []);

  const handleClose = (loadDemo = false) => {
    setIsVisible(false);
    try {
      localStorage.setItem(WELCOME_SEEN_KEY, '1');
    } catch {
      // Nothing to record; the splash simply shows again next time.
    }
    if (loadDemo && onLoadDemo) {
      onLoadDemo();
    }
    if (onClose) onClose();
  };

  const handleReadMore = () => {
    window.open('https://github.com/armstrys/class-list-builder#readme', '_blank');
  };

  if (!isVisible) return null;

  return (
    <Modal
      isOpen={true}
      onClose={handleClose}
      title="Welcome to Class List Builder"
      size="lg"
      closeOnOverlayClick={false}
      showCloseButton={false}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleReadMore}
            type="button"
          >
            📖 Read Documentation
          </button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setConfirmSkip(true)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handleClose(true)}
              type="button"
            >
              ▶️ Demo
            </button>
          </div>
        </div>
      }
    >
      <div className="welcome-content">
        {/* Privacy Section */}
        <div className="welcome-section welcome-privacy">
          <div className="welcome-icon">🔒</div>
          <div className="welcome-section-content">
            <h3>Student Data Stays Private</h3>
            <p>
              This tool runs entirely in your browser. <strong>Student data never leaves your computer</strong> —
              no uploads, no accounts, no servers. You can even verify this by turning off your internet connection
              after the page loads; the tool continues to work normally.
            </p>
          </div>
        </div>

        {/* Admin/IT Note - moved under privacy */}
        <div className="welcome-admin-note">
          <strong>🔍 Admin or IT?</strong> Review our
          <a href="https://github.com/armstrys/class-list-builder/blob/main/SECURITY.md" target="_blank" rel="noopener noreferrer"> security documentation</a>.
        </div>

        {/* Features Section */}
        <div className="welcome-section">
          <h3>What You Can Do</h3>
          <div className="feature-grid">
            <div className="feature-item">
              <div className="feature-icon">⚖️</div>
              <div className="feature-text">
                <strong>Balance Classes</strong>
                <span>Balance scores, gender, intervention needs, and more.</span>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🔗</div>
              <div className="feature-text">
                <strong>Set Constraints</strong>
                <span>Keep students together or apart (siblings, conflicts, etc.).</span>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">📊</div>
              <div className="feature-text">
                <strong>Import & Export</strong>
                <span>Import from CSV, export balanced lists.</span>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">💾</div>
              <div className="feature-text">
                <strong>Save Progress</strong>
                <span>Save your work and continue later.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Start */}
        <div className="welcome-section welcome-quickstart">
          <h3>Quick Start</h3>
          <ol className="quickstart-list">
            <li>Configure your criteria in <strong>Settings</strong> (top right)</li>
            <li>Set up your classes in the <strong>Teachers / Classes</strong> panel</li>
            <li>Import your students via <strong>Import Students</strong> or add them manually</li>
            <li>Click <strong>Optimize Classes</strong> to generate balanced lists</li>
          </ol>
        </div>

        {/* Offline Note */}
        <div className="welcome-note">
          <strong>💡 Tip:</strong> Want to use this offline? Download the standalone HTML file.
          <div style={{ marginTop: '8px' }}>
            <a href="https://github.com/armstrys/class-list-builder/releases" target="_blank" rel="noopener noreferrer" className="releases-link">➡️ Visit Releases Page</a>
          </div>
        </div>
      </div>

      <Modal
        isOpen={confirmSkip}
        onClose={() => setConfirmSkip(false)}
        title="Skip the demo?"
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => handleClose(false)} type="button">
              Skip the demo
            </button>
            {/* Answers the question it asks: it starts the demo, not just
                dismisses the confirmation. */}
            <button className="btn btn-primary" onClick={() => handleClose(true)} type="button">
              Show me the demo
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          The demo loads a full roster of sample students and starts the tour, so you can see the optimizer
          work before you enter your own. Nothing is saved until you save it, so you can stop at any time.
        </p>
      </Modal>
    </Modal>
  );
}
