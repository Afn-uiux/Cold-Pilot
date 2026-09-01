'use client';

import type { Variants } from 'motion/react';
import { motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { useIconAnimation } from '@/lib/use-icon-animation';
import { cn } from '@/lib/utils';

export interface BriefcaseIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface BriefcaseIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const briefcaseVariants: Variants = {
  normal: {
    scaleX: 1,
    scaleY: 1,
    transition: { type: 'spring', duration: 0.45, bounce: 0 },
  },
  animate: {
    scaleX: [1, 1.12, 0.98, 1],
    scaleY: [1, 0.95, 1.08, 1],
    transition: { duration: 0.7, ease: [0.23, 1, 0.32, 1] },
  },
};

const BriefcaseIcon = forwardRef<BriefcaseIconHandle, BriefcaseIconProps>(
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
          overflow="visible"
        >
          <motion.path
            d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            variants={briefcaseVariants}
            animate={controls}
            initial="normal"
            style={{ transformOrigin: '12px 12px' }}
          />
          <motion.path
            d="M22 7v13a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            variants={briefcaseVariants}
            animate={controls}
            initial="normal"
            style={{ transformOrigin: '12px 12px' }}
          />
          <motion.path
            d="M2 7h20"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            variants={briefcaseVariants}
            animate={controls}
            initial="normal"
            style={{ transformOrigin: '12px 12px' }}
          />
          <motion.line
            x1="9"
            y1="12"
            x2="15"
            y2="12"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.5"
            variants={briefcaseVariants}
            animate={controls}
            initial="normal"
            style={{ transformOrigin: '12px 12px' }}
          />
        </svg>
      </div>
    );
  }
);

BriefcaseIcon.displayName = 'BriefcaseIcon';

export { BriefcaseIcon };
