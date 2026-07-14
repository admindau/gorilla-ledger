import Link from "next/link";

type Prerequisite = {
  label: string;
  complete: boolean;
  href: string;
  actionLabel: string;
};

type PrerequisiteGuideProps = {
  items: Prerequisite[];
  title?: string;
};

export function PrerequisiteGuide({
  items,
  title = "Complete setup before continuing",
}: PrerequisiteGuideProps) {
  const missing = items.filter((item) => !item.complete);
  if (missing.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4" role="note">
      <p className="text-sm font-semibold text-amber-100">{title}</p>
      <p className="mt-1 text-xs leading-5 text-amber-100/65">
        This action needs the following ledger foundations.
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {missing.map((item) => (
          <li key={item.label}>
            <Link href={item.href} className="gl-btn gl-btn-secondary gl-btn-sm">
              {item.actionLabel}
              <span aria-hidden="true">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
