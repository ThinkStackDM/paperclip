import { cn } from "../lib/utils";

/**
 * Small pill marking a fallback "sister" lane agent (e.g. GLaD0S-Codex)
 * so agent lists can show the primary name once and tag clones with their
 * lane instead of repeating the full name. Lane detection lives in
 * lib/agent-lanes.ts.
 */
export function AgentLaneBadge({ lane, className }: { lane: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-border bg-muted/40 px-1.5 py-px text-[10px] font-medium text-muted-foreground",
        className,
      )}
      title={`Fallback lane: ${lane}`}
    >
      {lane}
    </span>
  );
}
