"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useRef,
} from "react";
import type {
  HTMLAttributes,
  MouseEventHandler,
  ReactElement,
  ReactNode,
} from "react";
import type { AnimatedIconHandle } from "@/lib/use-icon-animation";

interface IconTargetProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: MouseEventHandler<HTMLDivElement>;
  onClick?: MouseEventHandler<HTMLDivElement>;
}

/**
 * Wraps an animated icon so its animation also fires when the surrounding
 * content (the container you put this inside) is hovered or clicked — not just
 * when the icon itself is hit directly. The single child must be an animated
 * icon component (one exposing an AnimatedIconHandle via ref).
 */
export function IconTarget({
  children,
  onMouseEnter,
  onMouseLeave,
  onClick,
  className,
  ...props
}: IconTargetProps) {
  const iconRef = useRef<AnimatedIconHandle>(null);

  const trigger = () => iconRef.current?.startAnimation();

  const child = Children.only(children);
  const iconEl = isValidElement<{ ref?: React.Ref<AnimatedIconHandle> }>(child)
    ? cloneElement(
        child as ReactElement<{ ref?: React.Ref<AnimatedIconHandle> }>,
        { ref: iconRef },
      )
    : child;

  return (
    <div
      className={className}
      data-animated-icon
      onMouseEnter={(e) => {
        onMouseEnter?.(e);
        trigger();
      }}
      onMouseLeave={onMouseLeave}
      onClick={(e) => {
        onClick?.(e);
        trigger();
      }}
      {...props}
    >
      {iconEl}
    </div>
  );
}
