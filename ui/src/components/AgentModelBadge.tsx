import { cn } from "../lib/utils";
import type { AgentModelBadgeInfo, AgentModelTone } from "../lib/agent-lanes";

/**
 * Small colored pill showing the agent's CURRENT model provider (Claude / GPT /
 * Grok / Gemini), derived from its adapter — not its name. Shown on every agent
 * in the sidebar so the lane is identifiable at a glance; the exact model id is
 * in the tooltip. Provider detection lives in lib/agent-lanes.ts.
 */
const TONE_CLASSES: Record<AgentModelTone, string> = {
  claude:
    "border-amber-300/50 bg-amber-100/60 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
  gpt:
    "border-emerald-300/50 bg-emerald-100/60 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
  grok:
    "border-zinc-300/60 bg-zinc-100/70 text-zinc-600 dark:border-zinc-500/30 dark:bg-zinc-500/15 dark:text-zinc-300",
  gemini:
    "border-blue-300/50 bg-blue-100/60 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300",
};

export function AgentModelBadge({ badge, className }: { badge: AgentModelBadgeInfo; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-1.5 py-px text-[10px] font-medium",
        TONE_CLASSES[badge.tone],
        className,
      )}
      title={`Model: ${badge.title}`}
    >
      {badge.label}
    </span>
  );
}
