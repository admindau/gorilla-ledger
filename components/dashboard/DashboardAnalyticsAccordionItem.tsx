"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";

type DashboardAnalyticsAccordionItemProps = {
  title: string;
  kicker?: string;
  description?: string;
  defaultOpenOnMobile?: boolean;
  children: ReactNode;
};

export default function DashboardAnalyticsAccordionItem({
  title,
  kicker = "Analytics",
  description,
  defaultOpenOnMobile = false,
  children,
}: DashboardAnalyticsAccordionItemProps) {
  const contentId = useId();
  const headingId = useId();
  const sectionRef = useRef<HTMLElement | null>(null);
  // The server and browser now start from the same state. CSS keeps every
  // section visible on desktop, while this state controls only the mobile
  // accordion. This prevents hydration from collapsing a server-rendered
  // desktop layout after matchMedia runs.
  const [isOpen, setIsOpen] = useState(defaultOpenOnMobile);
  const [shouldRender, setShouldRender] = useState(defaultOpenOnMobile);

  useEffect(() => {
    if (shouldRender) return;

    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setShouldRender(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setShouldRender(true);
        observer.disconnect();
      },
      { rootMargin: "800px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldRender]);

  function toggleMobileSection() {
    setIsOpen((value) => {
      const next = !value;
      if (next) setShouldRender(true);
      return next;
    });
  }

  return (
    <section ref={sectionRef} className="gl-dashboard-section">
      <button
        type="button"
        onClick={toggleMobileSection}
        className="gl-dashboard-accordion-trigger md:hidden"
        aria-expanded={isOpen}
        aria-controls={contentId}
      >
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
            {kicker}
          </span>
          <span
            id={headingId}
            className="mt-1 block text-[0.95rem] font-semibold tracking-tight text-white"
          >
            {title}
          </span>
          {description ? (
            <span className="mt-1 block text-[11px] leading-4 text-gray-400">
              {description}
            </span>
          ) : null}
        </span>

        <span
          className={`gl-dashboard-accordion-icon ${isOpen ? "is-open" : ""}`}
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

      <div
        id={contentId}
        className={`gl-dashboard-accordion-content gl-fade-in ${isOpen ? "is-open" : ""}`}
        role="region"
        aria-labelledby={headingId}
      >
        {shouldRender ? (
          children
        ) : (
          <div
            className="gl-dashboard-deferred-placeholder"
            role="status"
            aria-label={`Preparing ${title}`}
          >
            <span>Preparing analytics…</span>
          </div>
        )}
      </div>
    </section>
  );
}
