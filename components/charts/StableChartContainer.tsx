"use client";

import {
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

type StableChartContainerProps = {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
};

/**
 * Defers mounting Recharts until its parent has a real, positive size.
 * This prevents ResponsiveContainer from measuring hidden, transitioning,
 * or not-yet-laid-out containers as -1 x -1, particularly in Safari.
 */
export default function StableChartContainer({
  children,
  className = "",
  ariaLabel,
}: StableChartContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isReady, setIsReady] = useState(false);

  const measure = useCallback(() => {
    const node = containerRef.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    const nextReady = rect.width > 1 && rect.height > 1;

    setIsReady((current) => (current === nextReady ? current : nextReady));
  }, []);

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    let frame = window.requestAnimationFrame(measure);
    let observer: ResizeObserver | null = null;

    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(measure);
      });
      observer.observe(node);
    } else {
      window.addEventListener("resize", measure);
    }

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  return (
    <div
      ref={containerRef}
      className={className}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
    >
      {isReady ? children : <div className="h-full w-full" aria-hidden="true" />}
    </div>
  );
}
