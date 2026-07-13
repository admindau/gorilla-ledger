"use client";

import { type ReactNode, useEffect, useId, useState } from "react";

type DashboardAnalyticsAccordionItemProps = {
  title: string;
  kicker?: string;
  description?: string;
  defaultOpenOnMobile?: boolean;
  children: ReactNode;
};

function matchesMobileViewport() {
  return typeof window !== "undefined"
    ? window.matchMedia("(max-width: 767px)").matches
    : false;
}

export default function DashboardAnalyticsAccordionItem({
  title,
  kicker = "Analytics",
  description,
  defaultOpenOnMobile = false,
  children,
}: DashboardAnalyticsAccordionItemProps) {
  const contentId = useId();
  const [isMobile, setIsMobile] = useState(matchesMobileViewport);
  const [isOpen, setIsOpen] = useState(() =>
    matchesMobileViewport() ? defaultOpenOnMobile : true
  );

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");

    const update = () => {
      const mobile = query.matches;
      setIsMobile(mobile);
      setIsOpen(mobile ? defaultOpenOnMobile : true);
    };

    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [defaultOpenOnMobile]);

  const expanded = !isMobile || isOpen;

  return (
    <section className="gl-dashboard-section">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="gl-dashboard-accordion-trigger md:hidden"
        aria-expanded={expanded}
        aria-controls={contentId}
      >
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
            {kicker}
          </span>
          <span className="mt-1 block text-[0.95rem] font-semibold tracking-tight text-white">
            {title}
          </span>
          {description ? (
            <span className="mt-1 block text-[11px] leading-4 text-gray-400">
              {description}
            </span>
          ) : null}
        </span>

        <span
          className={`gl-dashboard-accordion-icon ${expanded ? "is-open" : ""}`}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 20 20"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m5 7.5 5 5 5-5" />
          </svg>
        </span>
      </button>

      {expanded ? (
        <div id={contentId} className="gl-fade-in">
          {children}
        </div>
      ) : null}
    </section>
  );
}
