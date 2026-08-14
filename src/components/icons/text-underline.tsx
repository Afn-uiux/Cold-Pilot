'use client';

import type { Variants } from 'motion/react';
import { motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { useIconAnimation } from '@/lib/use-icon-animation';
import { cn } from '@/lib/utils';

export interface UnderlineIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface UnderlineIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

// the U dips into the bowl and the underscore sweeps in beneath it
const letterVariants: Variants = {
  normal: { pathLength: 1 },
  animate: {
    pathLength: [0.3, 1, 1],
    transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] },
  },
};

const underscoreVariants: Variants = {
  normal: { scaleX: 1 },
  animate: {
    scaleX: [0.2, 1.02, 1],
    transition: { duration: 0.45, ease: [0.23, 1, 0.32, 1] },
  },
};

const UnderlineIcon = forwardRef<UnderlineIconHandle, UnderlineIconProps>(
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
            d="M6 3v7a6 6 0 0 0 12 0V3"
            variants={letterVariants}
            animate={controls}
            initial="normal"
          />
          <motion.line
            x1="4"
            y1="21"
            x2="20"
            y2="21"
            variants={underscoreVariants}
            animate={controls}
            initial="normal"
            style={{ transformOrigin: '12px 21px' }}
          />
        </svg>
      </div>
    );
  }
);

UnderlineIcon.displayName = 'UnderlineIcon';

export { UnderlineIcon };
