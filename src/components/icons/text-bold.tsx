'use client';

import type { Variants } from 'motion/react';
import { motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { useIconAnimation } from '@/lib/use-icon-animation';
import { cn } from '@/lib/utils';

export interface BoldIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface BoldIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

// the B swells with weight, pressing into the stroke as it lands
const glyphVariants: Variants = {
  normal: { transform: 'scaleX(1) scaleY(1)', opacity: 1 },
  animate: {
    transform: ['scaleX(1) scaleY(1)', 'scaleX(0.92) scaleY(1.06)', 'scaleX(1.05) scaleY(0.98)', 'scaleX(1) scaleY(1)'],
    opacity: [1, 0.75, 1],
    transition: { duration: 0.55, ease: [0.23, 1, 0.32, 1] },
  },
};

const BoldIcon = forwardRef<BoldIconHandle, BoldIconProps>(
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
          <motion.path
            d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"
            variants={glyphVariants}
            animate={controls}
            initial="normal"
            style={{ transformOrigin: '12px 12px' }}
          />
          <motion.path
            d="M6 12h9a4 4 0 0 1 0 8H6z"
            variants={glyphVariants}
            animate={controls}
            initial="normal"
            style={{ transformOrigin: '12px 12px' }}
          />
        </svg>
      </div>
    );
  }
);

BoldIcon.displayName = 'BoldIcon';

export { BoldIcon };
