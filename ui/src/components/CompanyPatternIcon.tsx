import { useEffect, useMemo, useState } from "react";
import { cn } from "../lib/utils";

interface CompanyPatternIconProps {
  companyName: string;
  /**
   * Short identifier shown as the avatar label — typically the company's
   * issue prefix (e.g. "TSK", "DP", "TSMC"). Falls back to initials derived
   * from the company name when omitted.
   */
  prefix?: string | null;
  logoUrl?: string | null;
  brandColor?: string | null;
  className?: string;
  logoFit?: "cover" | "contain";
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const light = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function hexToHue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
}

const HEX6 = /^#?[0-9a-fA-F]{6}$/;

/** Initials fallback when no prefix is supplied: up to two leading letters. */
function initialsFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return (words[0] ?? "").slice(0, 2).toUpperCase() || "?";
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * Deterministic, distinct tile colours for a company. A custom `brandColor`
 * sets the hue; otherwise the hue is hashed from the seed so each company is
 * visually separable. Saturation/lightness stay in a band that reads on the
 * dark theme, and the label colour flips to dark on light (yellow/green) hues.
 */
function companyTileColors(seed: string, brandColor?: string | null) {
  const rand = mulberry32(hashString(seed));
  const normalizedBrand = brandColor && HEX6.test(brandColor)
    ? (brandColor.startsWith("#") ? brandColor : `#${brandColor}`)
    : null;
  const hue = normalizedBrand ? hexToHue(normalizedBrand) : Math.floor(rand() * 360);
  const sat = 60 + Math.floor(rand() * 14); // 60–74
  const topL = 53;
  const botL = 39;

  const [tr, tg, tb] = hslToRgb(hue, sat, topL);
  const [br, bg, bb] = hslToRgb(hue + 10, sat, botL);
  const [mr, mg, mb] = hslToRgb(hue, sat, (topL + botL) / 2);
  const luminance = (0.299 * mr + 0.587 * mg + 0.114 * mb) / 255;

  return {
    top: `rgb(${tr}, ${tg}, ${tb})`,
    bottom: `rgb(${br}, ${bg}, ${bb})`,
    fg: luminance > 0.6 ? "#17130a" : "#ffffff",
  };
}

/** Label font size (in the 100×100 viewBox) tuned so initials always fit. */
function labelFontSize(length: number): number {
  if (length <= 1) return 56;
  if (length === 2) return 45;
  if (length === 3) return 34;
  if (length === 4) return 26;
  return 21;
}

export function CompanyPatternIcon({
  companyName,
  prefix,
  logoUrl,
  brandColor,
  className,
  logoFit = "cover",
}: CompanyPatternIconProps) {
  const [imageError, setImageError] = useState(false);
  const logo = !imageError && typeof logoUrl === "string" && logoUrl.trim().length > 0 ? logoUrl : null;
  useEffect(() => {
    setImageError(false);
  }, [logoUrl]);

  const label = useMemo(() => {
    const fromPrefix = prefix?.trim();
    const text = fromPrefix && fromPrefix.length > 0 ? fromPrefix : initialsFromName(companyName);
    return text.toUpperCase().slice(0, 4);
  }, [prefix, companyName]);

  const gradientId = useMemo(
    () => `co-grad-${hashString(`${companyName}:${prefix ?? ""}`)}`,
    [companyName, prefix],
  );

  const colors = useMemo(
    () => companyTileColors(`${companyName.trim().toLowerCase()}:${prefix ?? ""}`, brandColor),
    [companyName, prefix, brandColor],
  );

  return (
    <div className={cn("relative flex items-center justify-center w-11 h-11 overflow-hidden", className)}>
      {logo ? (
        <img
          src={logo}
          alt={`${companyName} logo`}
          onError={() => setImageError(true)}
          className={cn(
            "absolute inset-0 h-full w-full",
            logoFit === "contain" ? "object-contain" : "object-cover",
          )}
        />
      ) : (
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid slice"
          role="img"
          aria-label={companyName}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={colors.top} />
              <stop offset="1" stopColor={colors.bottom} />
            </linearGradient>
          </defs>
          <rect width="100" height="100" fill={`url(#${gradientId})`} />
          <text
            x="50"
            y="54"
            textAnchor="middle"
            dominantBaseline="central"
            fill={colors.fg}
            fontFamily="inherit"
            fontWeight={700}
            fontSize={labelFontSize(label.length)}
            letterSpacing={label.length >= 3 ? -1.5 : 0}
          >
            {label}
          </text>
        </svg>
      )}
    </div>
  );
}
