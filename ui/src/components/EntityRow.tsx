import { type ReactNode } from "react";
import { Link } from "@/lib/router";
import { cn } from "../lib/utils";

interface EntityRowProps {
  leading?: ReactNode;
  identifier?: string;
  title: string;
  /** Rendered after the truncating title, e.g. a small badge. Stays visible when the title truncates. */
  titleSuffix?: ReactNode;
  subtitle?: string;
  trailing?: ReactNode;
  selected?: boolean;
  to?: string;
  onClick?: () => void;
  className?: string;
  reserveSubtitleSpace?: boolean;
}

export function EntityRow({
  leading,
  identifier,
  title,
  titleSuffix,
  subtitle,
  trailing,
  selected,
  to,
  onClick,
  className,
  reserveSubtitleSpace,
}: EntityRowProps) {
  const isClickable = !!(to || onClick);
  const classes = cn(
    "relative flex items-center gap-3 px-4 py-2 text-sm border-b border-border last:border-b-0 transition-colors",
    isClickable && "cursor-pointer hover:bg-accent/50",
    selected && "bg-ts-accent/10 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-ts-accent",
    className
  );

  const content = (
    <>
      {leading && <div className="flex items-center gap-2 shrink-0">{leading}</div>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {identifier && (
            <span className="text-xs text-muted-foreground font-mono shrink-0 relative top-[1px]">
              {identifier}
            </span>
          )}
          <span className="truncate">{title}</span>
          {titleSuffix}
        </div>
        {(subtitle || reserveSubtitleSpace) && (
          <p
            className={cn("text-xs text-muted-foreground truncate mt-0.5 min-h-4", !subtitle && "invisible")}
            aria-hidden={!subtitle}
          >
            {subtitle}
          </p>
        )}
      </div>
      {trailing && <div className="flex items-center gap-2 shrink-0">{trailing}</div>}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={cn("no-underline text-inherit", classes)} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <div className={classes} onClick={onClick}>
      {content}
    </div>
  );
}
