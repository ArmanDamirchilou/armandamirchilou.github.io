import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

interface RevealProps {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'span';
  /** adds a springy hover-lift micro-interaction (for cards) */
  hover?: boolean;
}

const SPRING = { type: 'spring' as const, stiffness: 320, damping: 22, mass: 0.6 };

export function Reveal({ children, delay = 0, y = 24, className, as = 'div', hover = false }: RevealProps) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] as typeof motion.div;

  return (
    <MotionTag
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={hover && !reduce ? { y: -5, scale: 1.012, transition: SPRING } : undefined}
    >
      {children}
    </MotionTag>
  );
}
