"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
} from "react";
import type {
  HTMLAttributes,
  MouseEventHandler,
  ReactElement,
  ReactNode,
  RefObject,
} from "react";
import type { AnimatedIconHandle } from "@/lib/use-icon-animation";

interface IconTargetProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: MouseEventHandler<HTMLDivElement>;
  onClick?: MouseEventHandler<HTMLDivElement>;
  /**
   * Optional ref the surrounding content can hold and call (e.g. a row or link
   * that contains this icon) so the icon animates when the surrounding content
   * is hovered or clicked — not just when the icon itself is hit.
   */
  triggerRef?: RefObject<AnimatedIconHandle | null>;
}

/**
 * Wraps an animated icon so its animation also fires when the surrounding
 * content (the container you put this inside) is hovered or clicked — not just
 * when the icon itself is hit directly. The child should be an animated icon
 * component (one exposing an AnimatedIconHandle via ref). The first valid
 * element child is used; extra/whitespace children are ignored so this stays
 * robust across server/client boundaries.
 */
export function IconTarget({
  children,
  triggerRef,
  onMouseEnter,
  onMouseLeave,
  onClick,
  className,
  ...props
}: IconTargetProps) {
  const iconRef = useRef<AnimatedIconHandle>(null);

  const trigger = () => iconRef.current?.startAnimation();

  useEffect(() => {
    if (!triggerRef) return;
    triggerRef.current = {
      startAnimation: () => iconRef.current?.startAnimation(),
      stopAnimation: () => iconRef.current?.stopAnimation(),
    };
    return () => {
      triggerRef.current = null;
    };
  }, [triggerRef]);

  const iconEl = Children.toArray(children).find(
    (c): c is ReactElement<{ ref?: React.Ref<AnimatedIconHandle> }> =>
      isValidElement(c),
  );

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
      {iconEl
        ? cloneElement(
            iconEl as ReactElement<{ ref?: React.Ref<AnimatedIconHandle> }>,
            { ref: iconRef },
          )
        : children}
    </div>
  );
}
