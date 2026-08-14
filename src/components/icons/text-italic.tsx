'use client';

import type { Variants } from 'motion/react';
import { motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { useIconAnimation } from '@/lib/use-icon-animation';
import { cn } from '@/lib/utils';

export interface ItalicIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface ItalicIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

// the slash leans into the letterforms, then springs back upright
const slantVariants: Variants = {
  normal: { transform: 'skewX(0deg)' },
  animate: {
    transform: ['skewX(0deg)', 'skewX(14deg)', 'skewX(-6deg)', 'skewX(0deg)'],
    transition: { duration: 0.55, ease: [0.23, 1, 0.32, 1] },
  },
};

const ItalicIcon = forwardRef<ItalicIconHandle, ItalicIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
    const controls = useAnimation();
    const { handleMouseEnter, handleMouseLeave } = useIconAnimation({
      controls,
      loops: false,
      onMouseEnter,
      onMouseLeave,
      ref,
    });

    return (
      <div
        className={cn(className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          overflow="visible"
        >
          <motion.g
            variants={slantVariants}
            animate={controls}
            initial="normal"
            style={{ transformOrigin: '12px 12px' }}
          >
            <line x1="19" y1="4" x2="10" y2="4" />
            <line x1="14" y1="20" x2="5" y2="20" />
            <line x1="15" y1="4" x2="9" y2="20" />
          </motion.g>
        </svg>
      </div>
    );
  }
);

ItalicIcon.displayName = 'ItalicIcon';

export { ItalicIcon };
