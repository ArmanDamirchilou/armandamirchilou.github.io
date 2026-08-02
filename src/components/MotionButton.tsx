import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

interface MotionButtonProps {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'secondary';
  className?: string;
}

const SPRING = { type: 'spring' as const, stiffness: 400, damping: 17 };

export function MotionButton({ children, onClick, href, variant = 'primary', className = '' }: MotionButtonProps) {
  const reduce = useReducedMotion();
  const cls = `${variant === 'primary' ? 'btn-primary' : 'btn-secondary'} ${className}`;

  const hover = reduce ? undefined : { scale: 1.04, y: -2, transition: SPRING };
  const tap = reduce ? undefined : { scale: 0.96, transition: SPRING };

  if (href) {
    return (
      <motion.a href={href} className={cls} whileHover={hover} whileTap={tap}>
        {children}
      </motion.a>
    );
  }
  return (
    <motion.button onClick={onClick} className={cls} whileHover={hover} whileTap={tap}>
      {children}
    </motion.button>
  );
}
