'use client';

import type { Variants } from 'motion/react';
import { motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { useIconAnimation } from '@/lib/use-icon-animation';
import { cn } from '@/lib/utils';

export interface DotIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface DotIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

// a single pulsing dot, swelling and settling like a heartbeat
const dotVariants: Variants = {
  normal: { transform: 'scale(1)', opacity: 1 },
  animate: {
    transform: ['scale(1)', 'scale(1.35)', 'scale(0.9)', 'scale(1)'],
    opacity: [1, 0.85, 1, 1],
    transition: { duration: 0.55, ease: [0.23, 1, 0.32, 1] },
  },
};

const DotIcon = forwardRef<DotIconHandle, DotIconProps>(
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
          fill="currentColor"
          stroke="none"
          overflow="visible"
        >
          <motion.circle
            cx="12"
            cy="12"
            r="4"
            variants={dotVariants}
            animate={controls}
            initial="normal"
            style={{ transformOrigin: '12px 12px' }}
          />
        </svg>
      </div>
    );
  }
);

DotIcon.displayName = 'DotIcon';

export { DotIcon };
