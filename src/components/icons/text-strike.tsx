'use client';

import type { Variants } from 'motion/react';
import { motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { useIconAnimation } from '@/lib/use-icon-animation';
import { cn } from '@/lib/utils';

export interface StrikethroughIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface StrikethroughIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

// the strike line whips across, slicing through the letterforms
const strikeVariants: Variants = {
  normal: { scaleX: 1, opacity: 1 },
  animate: {
    scaleX: [0.15, 1.04, 0.98, 1],
    opacity: [0.4, 1, 1],
    transition: { duration: 0.48, ease: [0.23, 1, 0.32, 1] },
  },
};

const StrikethroughIcon = forwardRef<StrikethroughIconHandle, StrikethroughIconProps>(
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
          <path d="M16.5 7.5C16.5 5.5 14 4 12 4c-2.5 0-4 1.5-4 3.5" />
          <path d="M7.5 16.5C7.5 18.5 10 20 12 20c2.5 0 4-1.5 4-3.5" />
          <motion.line
            x1="3"
            y1="12"
            x2="21"
            y2="12"
            variants={strikeVariants}
            animate={controls}
            initial="normal"
            style={{ transformOrigin: '12px 12px' }}
          />
        </svg>
      </div>
    );
  }
);

StrikethroughIcon.displayName = 'StrikethroughIcon';

export { StrikethroughIcon };
