'use client';

import type { Variants } from 'motion/react';
import { motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { useIconAnimation } from '@/lib/use-icon-animation';
import { cn } from '@/lib/utils';

export interface FlameIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface FlameIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const flameVariants: Variants = {
  normal: { scaleY: 1, scaleX: 1, transition: { type: 'spring', duration: 0.45, bounce: 0 } },
  animate: {
    scaleY: [1, 1.15, 0.92, 1.05, 1],
    scaleX: [1, 0.92, 1.08, 0.97, 1],
    transition: { duration: 0.8, ease: [0.23, 1, 0.32, 1] },
  },
};

const FlameIcon = forwardRef<FlameIconHandle, FlameIconProps>(
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
            d="M12 2C12 2 4 9.5 4 14C4 18.4183 7.58172 22 12 22C16.4183 22 20 18.4183 20 14C20 9.5 12 2 12 2Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            variants={flameVariants}
            animate={controls}
            initial="normal"
            style={{ transformOrigin: '12px 14px' }}
          />
          <motion.path
            d="M12 22C12 22 9 18 9 15C9 12.5 11 10 12 8.5C13 10 15 12.5 15 15C15 18 12 22 12 22Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            variants={flameVariants}
            animate={controls}
            initial="normal"
            style={{ transformOrigin: '12px 16px' }}
          />
        </svg>
      </div>
    );
  }
);

FlameIcon.displayName = 'FlameIcon';

export { FlameIcon };
