'use client';

import type { Variants } from 'motion/react';
import { motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { useIconAnimation } from '@/lib/use-icon-animation';
import { cn } from '@/lib/utils';

export interface TrendUpIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface TrendUpIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

// the arrow climbs the line and the marker nudges into the corner
const lineVariants: Variants = {
  normal: { pathLength: 1 },
  animate: {
    pathLength: [0.1, 1, 1],
    transition: { duration: 0.55, ease: [0.23, 1, 0.32, 1] },
  },
};

const arrowVariants: Variants = {
  normal: { transform: 'translate(0px, 0px)', opacity: 1 },
  animate: {
    transform: ['translate(0px, 0px)', 'translate(0.9px, -0.9px)', 'translate(0px, 0px)'],
    opacity: [0.3, 1, 1],
    transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] },
  },
};

const TrendUpIcon = forwardRef<TrendUpIconHandle, TrendUpIconProps>(
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
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          overflow="visible"
        >
          <motion.path
            d="M3 17l6-6 4 4 8-8"
            variants={lineVariants}
            animate={controls}
            initial="normal"
          />
          <motion.path
            d="M15 7h6v6"
            variants={arrowVariants}
            animate={controls}
            initial="normal"
            style={{ transformOrigin: '21px 7px' }}
          />
        </svg>
      </div>
    );
  }
);

TrendUpIcon.displayName = 'TrendUpIcon';

export { TrendUpIcon };
