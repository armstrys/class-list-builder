/**
 * WelcomeModal - Privacy-focused splash screen for GitHub Pages visitors
 *
 * Displays on first visit to GitHub Pages to inform users about:
 * - Privacy: Data stays on their computer
 * - Features: Brief overview of what the tool does
 * - Documentation: Link to README
 *
 * @param {Object} props
 * @param {Function} props.onClose - Close callback
 * @param {boolean} [props.forceShow=false] - Force display regardless of domain/localStorage (for testing)
 */
function WelcomeModal({ onClose, forceShow = false }) {
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    // Check if we're on GitHub Pages
    const isGitHubPages = window.location.hostname.includes('github.io');

    // Check if user has already seen the welcome modal
    const hasSeenWelcome = localStorage.getItem('welcomeModalSeen');

    // Check for URL parameter to force show (for local testing)
    const urlParams = new URLSearchParams(window.location.search);
    const forceWelcome = urlParams.get('welcome') === '1';

    // Show modal if:
    // 1. We're on GitHub Pages AND user hasn't seen it, OR
    // 2. Force show prop is enabled (for testing), OR
    // 3. URL parameter welcome=1 is set (for local testing)
    if ((isGitHubPages && !hasSeenWelcome) || forceShow || forceWelcome) {
      setIsVisible(true);
    }
  }, [forceShow]);

  const handleClose = () => {
    // Mark as seen in localStorage
    localStorage.setItem('welcomeModalSeen', 'true');
    setIsVisible(false);
    if (onClose) onClose();
  };

  const handleReadMore = () => {
    window.open('https://github.com/armstrys/class-list-optimizer#readme', '_blank');
  };

  if (!isVisible) return null;

  return (
    <Modal
      isOpen={true}
      onClose={handleClose}
      title="Welcome to Class List Optimizer"
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
          <button
            className="btn btn-primary"
            onClick={handleClose}
            type="button"
          >
            Get Started →
          </button>
        </div>
      }
    >
      <div className="welcome-content">
        {/* Privacy Section */}
        <div className="welcome-section welcome-privacy">
          <div className="welcome-icon">🔒</div>
          <div className="welcome-section-content">
            <h3>Your Data Stays Private</h3>
            <p>
              This tool runs entirely in your browser. <strong>Your student data never leaves your computer</strong> —
              no uploads, no accounts, no servers. You can even verify this by turning off your internet connection
              after the page loads; the tool continues to work normally.
            </p>
          </div>
        </div>

        {/* Features Section */}
        <div className="welcome-section">
          <h3>What You Can Do</h3>
          <div className="feature-grid">
            <div className="feature-item">
              <div className="feature-icon">⚖️</div>
              <div className="feature-text">
                <strong>Balance Classes</strong>
                <span>Automatically distribute students across classes while balancing academic scores, intervention needs, gender, and more.</span>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🔗</div>
              <div className="feature-text">
                <strong>Set Constraints</strong>
                <span>Keep specific students together (siblings, support pairs) or apart (conflicts, separations).</span>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">📊</div>
              <div className="feature-text">
                <strong>Import & Export</strong>
                <span>Import your roster from CSV, then export balanced class lists when you're done.</span>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">💾</div>
              <div className="feature-text">
                <strong>Save Progress</strong>
                <span>Save your complete working state and continue later with all your data intact.</span>
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
            <li>Import your students via <strong>Import CSV</strong> or add them manually</li>
            <li>Click <strong>Optimize Classes</strong> to generate balanced lists</li>
          </ol>
        </div>

        {/* Offline Note */}
        <div className="welcome-note">
          <strong>💡 Tip:</strong> Want to use this offline? Download the standalone HTML file from the Releases page.
          <div style={{ marginTop: '8px' }}>
            <a href="https://github.com/armstrys/class-list-optimizer/releases" target="_blank" rel="noopener noreferrer" className="releases-link">➡️ Visit Releases Page</a>
          </div>
        </div>
      </div>
    </Modal>
  );
}
