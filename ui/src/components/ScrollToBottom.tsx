import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { usePanel } from "../context/PanelContext";
import { cn } from "../lib/utils";

function resolveScrollTarget() {
  const mainContent = document.getElementById("main-content");

  if (mainContent instanceof HTMLElement) {
    const overflowY = window.getComputedStyle(mainContent).overflowY;
    const usesOwnScroll =
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay")
      && mainContent.scrollHeight > mainContent.clientHeight + 1;

    if (usesOwnScroll) {
      return { type: "element" as const, element: mainContent };
    }
  }

  return { type: "window" as const };
}

function distanceFromBottom(target: ReturnType<typeof resolveScrollTarget>) {
  if (target.type === "element") {
    return target.element.scrollHeight - target.element.scrollTop - target.element.clientHeight;
  }

  const scroller = document.scrollingElement ?? document.documentElement;
  return scroller.scrollHeight - window.scrollY - window.innerHeight;
}

function distanceFromTop(target: ReturnType<typeof resolveScrollTarget>) {
  if (target.type === "element") {
    return target.element.scrollTop;
  }

  return window.scrollY;
}

/**
 * Floating scroll button that follows the active page scroller. On desktop that
 * is `#main-content`; on mobile it falls back to window/page scroll.
 *
 * `direction` picks which end it jumps to:
 *  - "bottom" (default): down arrow, jumps to the newest content. For pages that
 *    open at the top (e.g. agent activity loaded oldest-first).
 *  - "top": up arrow, jumps to the oldest content. For pages that already open
 *    at the latest message (the issue thread), where the useful jump is back up
 *    to the start.
 */
export function ScrollToBottom({ direction = "bottom" }: { direction?: "bottom" | "top" } = {}) {
  const [visible, setVisible] = useState(false);
  const { panelVisible, panelContent } = usePanel();

  useEffect(() => {
    const check = () => {
      const target = resolveScrollTarget();
      const distance = direction === "top"
        ? distanceFromTop(target)
        : distanceFromBottom(target);
      setVisible(distance > 300);
    };

    const mainContent = document.getElementById("main-content");

    check();
    mainContent?.addEventListener("scroll", check, { passive: true });
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);

    return () => {
      mainContent?.removeEventListener("scroll", check);
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [direction]);

  const scroll = useCallback(() => {
    const target = resolveScrollTarget();

    if (target.type === "element") {
      const top = direction === "top" ? 0 : target.element.scrollHeight;
      target.element.scrollTo({ top, behavior: "smooth" });
      return;
    }

    const scroller = document.scrollingElement ?? document.documentElement;
    const top = direction === "top" ? 0 : scroller.scrollHeight;
    window.scrollTo({ top, behavior: "smooth" });
  }, [direction]);

  if (!visible) return null;

  const Icon = direction === "top" ? ArrowUp : ArrowDown;

  return (
    <button
      onClick={scroll}
      className={cn(
        "fixed bottom-(--sz-calc-21) right-6 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background shadow-md hover:bg-accent transition-(--tp-background-color-right) duration-200 md:bottom-6",
        panelVisible && panelContent && "md:right-(--sz-calc-22)",
      )}
      aria-label={direction === "top" ? "Scroll to oldest" : "Scroll to bottom"}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
