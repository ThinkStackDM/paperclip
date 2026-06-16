import { useId } from "react";
import { cn } from "../lib/utils";

export type ThinkStackBrandVariant = "dark" | "light";

/**
 * Inline recreation of the ThinkStack brand mark: gradient shapes carved apart
 * by thick negative-space channels. Three rounded shapes — a large arrow on the
 * left (red->orange->yellow), a small triangle top-right (green) and a pentagon
 * bottom-right (yellow->green) — share one user-space gradient that sweeps
 * red->orange->yellow->green, so each shape picks up its segment of the ramp.
 *
 * Two official variants (see `public/brands/`):
 *  - `dark` (default): gradient on a near-black rounded tile with black
 *    channels — for dark surfaces / dark mode.
 *  - `light`: transparent tile with white channels — for light surfaces.
 *
 * Gradient + clip ids are namespaced with useId so the mark can render more
 * than once per document (sidebar nav + page header).
 */
export function ThinkStackLogo({
  className,
  size = 24,
  variant = "dark",
}: {
  className?: string;
  size?: number;
  variant?: ThinkStackBrandVariant;
}) {
  const uid = useId();
  const gradientId = `ts-grad-${uid}`;
  const clipId = `ts-clip-${uid}`;
  const onDark = variant !== "light";
  // The channels are the surrounding surface colour showing through, so they
  // read as negative space: near-black on dark, white on light.
  const channel = onDark ? "#0a0a0c" : "#ffffff";

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="ThinkStack"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="2" y1="32" x2="62" y2="32">
          <stop offset="0" stopColor="#e85d4a" />
          <stop offset="0.4" stopColor="#f5a623" />
          <stop offset="0.62" stopColor="#f7d038" />
          <stop offset="1" stopColor="#5cb85c" />
        </linearGradient>
        <clipPath id={clipId}>
          <rect x="1" y="1" width="62" height="62" rx="15" />
        </clipPath>
      </defs>

      {/* Dark tile (dark variant only; the light variant is transparent) */}
      {onDark && <rect x="1" y="1" width="62" height="62" rx="15" fill="#0a0a0c" />}

      <g clipPath={`url(#${clipId})`}>
        {/* Full gradient field; the negative-space "T" below carves it into the
            three brand shapes (red arrow left, green triangle top-right via the
            overlay, gold/green pentagon bottom-right). */}
        <rect x="1" y="1" width="62" height="62" fill={`url(#${gradientId})`} />
        {/* Green corner: the top-right wedge sits at the gold/green end of the
            ramp, nudged fully green to match the brand. */}
        <path d="M40 1 L63 1 L63 26 Z" fill="#5cb85c" />
        {/* The brand "T", as negative space, rotated ~45°: the CROSSBAR runs
            along the green corner's edge (top-right), and the STEM drops
            perpendicular from the crossbar's middle down to the lower-left —
            splitting the red mass (upper-left) from the gold/green pentagon
            (lower-right). Round caps soften the inner corners. */}
        <g stroke={channel} strokeWidth="8" strokeLinecap="round">
          {/* crossbar — along the sharp green border */}
          <line x1="39" y1="0" x2="64" y2="27" />
          {/* stem — perpendicular, crossbar middle to lower-left */}
          <line x1="51" y1="13" x2="7" y2="61" />
        </g>
      </g>
    </svg>
  );
}

/**
 * The full ThinkStack lockup: the brand mark next to the "ThinkStack"
 * wordmark — the banner treatment, for mastheads where there is horizontal
 * room (e.g. the Portfolio header). The wordmark uses the app font in a
 * heavy weight with tight tracking to echo the brand banner.
 */
export function ThinkStackWordmark({
  className,
  iconSize = 30,
  textClassName,
  variant = "dark",
}: {
  className?: string;
  iconSize?: number;
  textClassName?: string;
  variant?: ThinkStackBrandVariant;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <ThinkStackLogo size={iconSize} variant={variant} className="shrink-0" />
      <span
        className={cn(
          "text-2xl font-extrabold leading-none tracking-tight",
          // dark variant rides the theme (white on the dark app); light variant
          // pins to the brand's dark wordmark for use on light surfaces.
          variant === "light" ? "text-[#2b2b2b]" : "text-foreground",
          textClassName,
        )}
      >
        ThinkStack
      </span>
    </span>
  );
}
