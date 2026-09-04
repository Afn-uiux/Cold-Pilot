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
 *
 * Quality notes (the logo renders tiny — 18-22px tall — so every pixel of
 * the thin wordmark strokes matters):
 * - quality={100}: Next.js default (75) AVIF/WebP conversion rings and
 *   mushes thin high-contrast strokes. Near-lossless keeps edges crisp.
 * - sizes="120px": the logo renders ~74-91px wide. Without this, Next
 *   defaults to 100vw and the browser picks a wrong srcset candidate
 *   (blurry upscale on retina). This lets 2x/3x screens get a true 2x asset.
 */
export default function Logo({ height = 20, className, linkClassName }: LogoProps) {
  return (
    <Image
      src="/coldpilot-logo.png"
      alt="Coldpilot"
      width={955}
      height={231}
      quality={100}
      sizes="120px"
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
