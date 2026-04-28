/**
 * Modal - Reusable accessible modal component with focus trap
 * 
 * Features:
 * - Focus trap on open (cycles through focusable elements)
 * - Restores focus on close
 * - Closes on Escape key and outside click
 * - ARIA attributes for screen readers
 * - Hides background content from screen readers
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is visible
 * @param {Function} props.onClose - Close callback
 * @param {string} props.title - Modal title (for aria-labelledby)
 * @param {React.ReactNode} props.children - Modal content
 * @param {string} [props.size='md'] - Modal size: 'sm', 'md', 'lg', 'xl'
 * @param {boolean} [props.closeOnOverlayClick=true] - Close when clicking overlay
 * @param {boolean} [props.showCloseButton=true] - Show X button in header
 * @param {React.ReactNode} [props.footer] - Optional footer content
 * @param {Object} [props.style] - Additional styles for modal container
 */
function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  showCloseButton = true,
  footer,
  style = {}
}) {
  const overlayRef = useRef(null);
  const modalRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const titleId = useMemo(() => `modal-title-${Math.random().toString(36).substr(2, 9)}`, []);

  // Size-based max widths
  const sizeStyles = {
    sm: { maxWidth: 400 },
    md: { maxWidth: 480 },
    lg: { maxWidth: 560 },
    xl: { maxWidth: 700 }
  };

  // Store previously focused element and trap focus
  useEffect(() => {
    if (isOpen) {
      // Store the element that had focus before opening
      previouslyFocusedRef.current = document.activeElement;
      
      // Focus the modal container
      if (modalRef.current) {
        modalRef.current.focus();
      }

      // Add aria-hidden to main content
      const mainContent = document.getElementById('root') || document.body;
      if (mainContent) {
        mainContent.setAttribute('aria-hidden', 'true');
      }
    } else {
      // Restore focus when closing
      if (previouslyFocusedRef.current) {
        previouslyFocusedRef.current.focus();
      }

      // Remove aria-hidden from main content
      const mainContent = document.getElementById('root') || document.body;
      if (mainContent) {
        mainContent.removeAttribute('aria-hidden');
      }
    }

    return () => {
      // Cleanup: ensure aria-hidden is removed if component unmounts while open
      const mainContent = document.getElementById('root') || document.body;
      if (mainContent) {
        mainContent.removeAttribute('aria-hidden');
      }
    };
  }, [isOpen]);

  // Handle keyboard events (Escape and Tab trapping)
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        // Focus trap logic
        const focusableElements = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          // Shift + Tab: go backwards
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: go forwards
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle overlay click
  function handleOverlayClick(e) {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  }

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={modalRef}
        className={`modal modal-${size}`}
        style={{ ...sizeStyles[size], ...style }}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title" id={titleId}>{title}</div>
          {showCloseButton && (
            <button 
              className="btn btn-ghost btn-sm" 
              onClick={onClose}
              aria-label="Close modal"
            >
              ✕
            </button>
          )}
        </div>
        
        <div className="modal-body">
          {children}
        </div>

        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
