import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onAccept: () => void;
  title: string;
  children: ReactNode;
  eyebrow?: string;
  acceptLabel?: string;
  /** theme accent for the top bar + icon chip */
  accent?: 'azure' | 'coral' | 'green' | 'indigo';
  icon?: ReactNode;
}

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Neo-brutalist modal: blurred backdrop, thick-bordered card with a hard offset
 * shadow, a bold accent bar, an icon chip, and a chunky Accept button. Springs
 * in with a slight overshoot + straighten. Accessible: role=dialog, focus moves
 * to Accept, Enter/Escape both accept.
 */
export function Modal({
  open,
  onAccept,
  title,
  children,
  eyebrow,
  acceptLabel = 'Accept',
  accent = 'azure',
  icon,
}: ModalProps) {
  const reduce = useReducedMotion();
  const acceptRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const btn = acceptRef.current;
    const raf = requestAnimationFrame(() => btn?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        onAccept();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onAccept]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onAccept}
        >
          <motion.div
            className={`modal-card accent-${accent}`}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.82, y: 34, rotate: -3 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0, rotate: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 20, rotate: 2 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22, mass: 0.8 }}
          >
            <span className="modal-accent-bar" aria-hidden />
            {icon && <div className="modal-icon" aria-hidden>{icon}</div>}
            {eyebrow && <span className="modal-eyebrow">{eyebrow}</span>}
            <h2 className="modal-title">{title}</h2>
            <div className="modal-body">{children}</div>
            <button ref={acceptRef} className="modal-accept" onClick={onAccept}>
              {acceptLabel}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                <path d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
