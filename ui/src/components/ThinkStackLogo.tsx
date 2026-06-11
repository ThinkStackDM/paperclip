import { useId } from "react";

/**
 * Inline approximation of the ThinkStack brand mark: a dark rounded square
 * split by a thick white diagonal channel that forms a stylized pickaxe / "T".
 * Three rounded shapes sit on the dark tile — a large triangle-ish shape on
 * the left (red->orange->yellow), a small triangle top-right (green) and a
 * larger pentagon bottom-right (yellow->green). One shared user-space
 * gradient sweeps red->orange->yellow->green across the tile so each shape
 * naturally picks up its segment of the hue ramp.
 *
 * Gradient + clip ids are namespaced with useId so the mark can render more
 * than once per document (sidebar nav + page header).
 */
export function ThinkStackLogo({ className, size = 24 }: { className?: string; size?: number }) {
  const uid = useId();
  const gradientId = `ts-grad-${uid}`;
  const clipId = `ts-clip-${uid}`;

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
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="8" y1="8" x2="56" y2="56">
          <stop offset="0" stopColor="#e85d4a" />
          <stop offset="0.45" stopColor="#f5a623" />
          <stop offset="0.7" stopColor="#f7d038" />
          <stop offset="1" stopColor="#5cb85c" />
        </linearGradient>
        <clipPath id={clipId}>
          <rect x="1" y="1" width="62" height="62" rx="14" />
        </clipPath>
      </defs>

      {/* Dark tile */}
      <rect x="1" y="1" width="62" height="62" rx="14" fill="#101013" />

      <g clipPath={`url(#${clipId})`}>
        {/* Large triangle-ish shape, left (red -> orange -> yellow). The
            stroke matches the fill and uses round joins purely to round
            the polygon corners. */}
        <path
          d="M11 11 L41 11 L20 53 L11 53 Z"
          fill={`url(#${gradientId})`}
          stroke={`url(#${gradientId})`}
          strokeWidth="6"
          strokeLinejoin="round"
        />
        {/* Small triangle, top-right (green) */}
        <path
          d="M49 11 L53 13 L46 22 Z"
          fill="#5cb85c"
          stroke="#5cb85c"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        {/* Pentagon, bottom-right (yellow -> green) */}
        <path
          d="M37 28 L47 31 L53 38 L53 53 L27 53 Z"
          fill={`url(#${gradientId})`}
          stroke={`url(#${gradientId})`}
          strokeWidth="6"
          strokeLinejoin="round"
        />
        {/* White diagonal channel: the pickaxe handle... */}
        <line x1="45" y1="2" x2="21" y2="62" stroke="#ffffff" strokeWidth="6.5" strokeLinecap="round" />
        {/* ...and the short perpendicular branch that completes the "T" */}
        <line x1="37" y1="23" x2="61" y2="32" stroke="#ffffff" strokeWidth="6.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}
