'use client';

import type { Variants } from 'motion/react';
import { motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { useIconAnimation } from '@/lib/use-icon-animation';
import { cn } from '@/lib/utils';

export interface TextColorIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface TextColorIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

// the paint drop bulges and drips toward the baseline, then snaps back
const dropVariants: Variants = {
  normal: { transform: 'translateY(0px) scaleY(1)' },
  animate: {
    transform: ['translateY(0px) scaleY(1)', 'translateY(0.8px) scaleY(1.18)', 'translateY(1.6px) scaleY(0.82)', 'translateY(0px) scaleY(1)'],
    transition: { duration: 0.58, ease: [0.23, 1, 0.32, 1] },
  },
};

const baselineVariants: Variants = {
  normal: { scaleX: 1 },
  animate: {
    scaleX: [0.3, 1.02, 1],
    transition: { duration: 0.45, ease: [0.23, 1, 0.32, 1] },
  },
};

const TextColorIcon = forwardRef<TextColorIconHandle, TextColorIconProps>(
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
            d="M12 3l4 12-4-2-4 2z"
            variants={dropVariants}
            animate={controls}
            initial="normal"
            style={{ transformOrigin: '12px 14px' }}
          />
          <motion.line
            x1="4"
            y1="20"
            x2="20"
            y2="20"
            variants={baselineVariants}
            animate={controls}
            initial="normal"
            style={{ transformOrigin: '12px 20px' }}
          />
        </svg>
      </div>
    );
  }
);

TextColorIcon.displayName = 'TextColorIcon';

export { TextColorIcon };
