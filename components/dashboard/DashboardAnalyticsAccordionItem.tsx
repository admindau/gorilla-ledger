"use client";

import { type ReactNode, useEffect, useState } from "react";

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
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(defaultOpenOnMobile);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => {
      const mobile = query.matches;
      setIsMobile(mobile);
      if (!mobile) setIsOpen(true);
      if (mobile) setIsOpen(defaultOpenOnMobile);
    };

    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [defaultOpenOnMobile]);

  const expanded = !isMobile || isOpen;

  return (
    <section className="mb-7 md:mb-12">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="mb-3 flex w-full items-center justify-between gap-4 rounded-[1.25rem] border border-white/10 bg-white/[0.025] px-4 py-3 text-left transition hover:border-white/20 md:hidden"
        aria-expanded={expanded}
      >
        <span>
          <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">
            {kicker}
          </span>
          <span className="mt-1 block text-sm font-semibold tracking-tight text-white">
            {title}
          </span>
          {description ? (
            <span className="mt-1 block text-[11px] leading-4 text-gray-400">
              {description}
            </span>
          ) : null}
        </span>

        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/50 text-lg leading-none text-gray-200">
          {expanded ? "−" : "+"}
        </span>
      </button>

      {expanded ? <div>{children}</div> : null}
    </section>
  );
}
