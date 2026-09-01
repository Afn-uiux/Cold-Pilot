"use client";

import Link from "next/link";
import { useRef } from "react";
import type { MouseEventHandler, ReactNode } from "react";
import { IconTarget } from "@/components/icon-target";
import type { AnimatedIconHandle } from "@/lib/use-icon-animation";

interface IconHoverProps {
  icon: ReactNode;
  className?: string;
  children?: ReactNode;
  href?: string;
  iconPosition?: "start" | "end";
  onMouseEnter?: MouseEventHandler<HTMLElement>;
  onMouseLeave?: MouseEventHandler<HTMLElement>;
  onClick?: MouseEventHandler<HTMLElement>;
}

function useIconTrigger() {
  const ref = useRef<AnimatedIconHandle>(null);
  return {
    triggerRef: ref,
    trigger: () => ref.current?.startAnimation(),
  };
}

export function IconHover({
  icon,
  className,
  children,
  href,
  iconPosition = "start",
  onMouseEnter,
  onMouseLeave,
  onClick,
}: IconHoverProps) {
  const { triggerRef, trigger } = useIconTrigger();

  const iconEl = (
    <IconTarget triggerRef={triggerRef} className="inline-flex items-center">
      {icon}
    </IconTarget>
  );

  const Tag = href ? "a" : "span";

  return (
    <Tag
      href={href}
      className={className}
      onMouseEnter={(e) => {
        onMouseEnter?.(e);
        trigger();
      }}
      onMouseLeave={onMouseLeave}
      onClick={(e) => {
        onClick?.(e);
        trigger();
      }}
    >
      <span className="inline-flex items-center gap-1">
        {iconPosition === "start" ? iconEl : null}
        {children}
        {iconPosition === "end" ? iconEl : null}
      </span>
    </Tag>
  );
}

export function IconHoverLink({
  icon,
  href,
  className,
  children,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: IconHoverProps) {
  const { triggerRef, trigger } = useIconTrigger();

  return (
    <Link
      href={href ?? "#"}
      className={className}
      onMouseEnter={(e) => {
        onMouseEnter?.(e);
        trigger();
      }}
      onMouseLeave={onMouseLeave}
      onClick={(e) => {
        onClick?.(e);
        trigger();
      }}
    >
      {children}
      <IconTarget triggerRef={triggerRef} className="inline-flex items-center">
        {icon}
      </IconTarget>
    </Link>
  );
}

export function StepItem({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  const { triggerRef, trigger } = useIconTrigger();

  return (
    <li
      className="step"
      onMouseEnter={() => trigger()}
      onClick={() => trigger()}
    >
      <div className="step-illust">
        <IconTarget triggerRef={triggerRef}>{icon}</IconTarget>
      </div>
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </li>
  );
}