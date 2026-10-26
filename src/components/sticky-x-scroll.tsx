import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Wraps a wide table so its horizontal scrollbar stays pinned to the bottom of the window
// while any part of the table is on screen, instead of sitting under the last row (which can
// be far below the fold). The real scrollbar is hidden and a mirrored one is stuck to the
// bottom; scrolling either one moves the table. When nothing overflows, no bar is shown.
//
// The table inside must not scroll by itself: render it with `containerClassName="overflow-visible"`.
export function StickyXScroll({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const measure = () => {
      setContentWidth(body.scrollWidth);
      setOverflowing(body.scrollWidth > body.clientWidth + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    // The table can grow wider than its wrapper (new rows, wrapped text), so watch it directly.
    const table = body.querySelector("table");
    if (table) observer.observe(table);
    return () => observer.disconnect();
  }, []);

  // Each side only writes when the position differs, so the two never ping-pong.
  const syncBar = () => {
    const body = bodyRef.current;
    const bar = barRef.current;
    if (body && bar && bar.scrollLeft !== body.scrollLeft) bar.scrollLeft = body.scrollLeft;
  };
  const syncBody = () => {
    const body = bodyRef.current;
    const bar = barRef.current;
    if (body && bar && body.scrollLeft !== bar.scrollLeft) body.scrollLeft = bar.scrollLeft;
  };

  return (
    <div className={cn("rounded-md border", className)}>
      <div
        ref={bodyRef}
        onScroll={syncBar}
        className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <div
        ref={barRef}
        onScroll={syncBody}
        aria-hidden="true"
        className={cn(
          "sticky bottom-0 z-20 overflow-x-auto rounded-b-md border-t bg-card",
          !overflowing && "hidden",
        )}
      >
        <div style={{ width: contentWidth, height: 1 }} />
      </div>
    </div>
  );
}
