import Image from "next/image";

interface LogoProps {
  height?: number;
  className?: string;
  linkClassName?: string;
}

/**
 * Brand logo (icon + "cold pilot" wordmark) used across the site, replacing
 * the previous text-only wordmark. Renders the trimmed raster logo from
 * /public/coldpilot-logo.png. The source is a 955x231 bitmap (~4:1).
 */
export default function Logo({ height = 20, className, linkClassName }: LogoProps) {
  return (
    <Image
      src="/coldpilot-logo.png"
      alt="Coldpilot"
      width={955}
      height={231}
      style={{ height, width: "auto", display: "block" }}
      className={className}
      priority
    />
  );
}

export function LogoLink({
  href,
  height = 20,
  className,
}: {
  href: string;
  height?: number;
  className?: string;
}) {
  return (
    <a href={href} className={className} style={{ display: "inline-flex", alignItems: "center" }}>
      <Logo height={height} />
    </a>
  );
}
