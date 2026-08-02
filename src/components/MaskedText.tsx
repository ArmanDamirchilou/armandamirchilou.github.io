import { motion, useReducedMotion } from 'framer-motion';

const EASE = [0.104, 0.204, 0.492, 1] as const;

interface MaskedTextProps {
  lines: string[];
  className?: string;
  as?: 'h1' | 'h2' | 'p' | 'div';
  delay?: number;
}

/**
 * Garden-Eight-style masked line reveal: each line sits in an overflow-hidden
 * wrapper and slides up from 110% on first view. Reduced motion renders static.
 */
export function MaskedText({ lines, className, as: Tag = 'h1', delay = 0 }: MaskedTextProps) {
  const reduce = useReducedMotion();

  return (
    <Tag className={className}>
      {lines.map((line, i) => (
        <span className="mask-line" key={line}>
          <motion.span
            className="mask-line-inner"
            initial={reduce ? false : { y: '110%' }}
            whileInView={{ y: '0%' }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1.1, delay: delay + i * 0.12, ease: EASE }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}
