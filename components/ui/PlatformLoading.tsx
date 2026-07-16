import Skeleton from "@/components/ui/Skeleton";
import { PageShell } from "@/components/ui/PageShell";

type PlatformPageSkeletonProps = {
  eyebrow?: string;
  titleWidth?: string;
  descriptionWidth?: string;
  kpiCount?: number;
  sections?: number;
  variant?: "dashboard" | "standard" | "timeline" | "settings";
};

function HeaderSkeleton({
  titleWidth = "w-64",
  descriptionWidth = "w-96",
}: Pick<PlatformPageSkeletonProps, "titleWidth" | "descriptionWidth">) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-3 w-28" rounded="full" />
      <Skeleton className={`h-8 ${titleWidth} max-w-full`} rounded="lg" />
      <Skeleton className={`h-4 ${descriptionWidth} max-w-full`} rounded="lg" />
    </div>
  );
}

function DashboardHeaderSkeleton() {
  return (
    <div className="gl-dashboard-page-header">
      <HeaderSkeleton titleWidth="w-44" descriptionWidth="w-[28rem]" />
      <Skeleton className="h-11 w-full sm:w-60" rounded="full" />
    </div>
  );
}

function KpiGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="gl-premium-card p-5">
          <Skeleton className="h-3 w-24" rounded="full" />
          <Skeleton className="mt-5 h-8 w-28" rounded="lg" />
          <Skeleton className="mt-3 h-3 w-36" rounded="full" />
        </div>
      ))}
    </div>
  );
}

function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="gl-premium-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-40" rounded="lg" />
              <Skeleton className="mt-3 h-3 w-52" rounded="full" />
            </div>
            <Skeleton className="h-9 w-20" rounded="full" />
          </div>
          <Skeleton className="mt-6 h-2 w-full" rounded="full" />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Skeleton className="h-12" rounded="xl" />
            <Skeleton className="h-12" rounded="xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-6">
      {["w-20", "w-28", "w-24"].map((width, groupIndex) => (
        <section key={groupIndex} className="space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className={`h-3 ${width}`} rounded="full" />
            <div className="h-px flex-1 bg-white/10" />
          </div>
          {Array.from({ length: groupIndex === 0 ? 3 : 2 }).map((_, index) => (
            <div key={index} className="gl-premium-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 gap-3">
                  <Skeleton className="h-10 w-10 shrink-0" rounded="full" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-44" rounded="lg" />
                    <Skeleton className="mt-3 h-3 w-60 max-w-full" rounded="full" />
                    <Skeleton className="mt-3 h-3 w-36" rounded="full" />
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <Skeleton className="h-5 w-24" rounded="lg" />
                  <Skeleton className="mt-3 h-8 w-20" rounded="full" />
                </div>
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="gl-hero-card rounded-[1.9rem] p-5 sm:p-7">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
          <div className="min-w-0">
            <Skeleton className="h-5 w-36" rounded="full" />
            <Skeleton className="mt-4 h-10 w-52 max-w-full" rounded="lg" />
            <Skeleton className="mt-3 h-4 w-full max-w-xl" rounded="lg" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-24" rounded="2xl" />
            <Skeleton className="h-24" rounded="2xl" />
          </div>
        </div>
      </div>
      <KpiGridSkeleton count={4} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-80" rounded="2xl" />
        <Skeleton className="h-80" rounded="2xl" />
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-5">
      <KpiGridSkeleton count={4} />
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Skeleton className="h-72" rounded="2xl" />
        <div className="space-y-4">
          <Skeleton className="h-32" rounded="2xl" />
          <Skeleton className="h-32" rounded="2xl" />
        </div>
      </div>
    </div>
  );
}

export function PlatformPageSkeleton({
  titleWidth = "w-64",
  descriptionWidth = "w-96",
  kpiCount = 4,
  sections = 6,
  variant = "standard",
}: PlatformPageSkeletonProps) {
  return (
    <PageShell>
      <div className="space-y-8">
        {variant === "dashboard" ? (
          <DashboardHeaderSkeleton />
        ) : (
          <HeaderSkeleton titleWidth={titleWidth} descriptionWidth={descriptionWidth} />
        )}

        {variant === "dashboard" ? (
          <DashboardSkeleton />
        ) : variant === "timeline" ? (
          <>
            <KpiGridSkeleton count={kpiCount} />
            <Skeleton className="h-28" rounded="2xl" />
            <TimelineSkeleton />
          </>
        ) : variant === "settings" ? (
          <SettingsSkeleton />
        ) : (
          <>
            <KpiGridSkeleton count={kpiCount} />
            <CardGridSkeleton count={sections} />
          </>
        )}
      </div>
    </PageShell>
  );
}

export function DashboardLoadingSkeleton() {
  return <PlatformPageSkeleton variant="dashboard" titleWidth="w-80" descriptionWidth="w-[28rem]" />;
}

export function WalletsLoadingSkeleton() {
  return (
    <PageShell>
      <div className="space-y-6">
        <HeaderSkeleton titleWidth="w-44" descriptionWidth="w-80" />
        <Skeleton className="h-[23rem] sm:h-[21rem]" rounded="2xl" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" rounded="2xl" />
          <Skeleton className="h-32" rounded="2xl" />
          <Skeleton className="h-32" rounded="2xl" />
        </div>
      </div>
    </PageShell>
  );
}

export function TransactionsLoadingSkeleton() {
  return <PlatformPageSkeleton variant="timeline" titleWidth="w-72" descriptionWidth="w-[30rem]" />;
}

export function BudgetsLoadingSkeleton() {
  return <PlatformPageSkeleton titleWidth="w-72" descriptionWidth="w-[30rem]" sections={4} />;
}

export function RecurringLoadingSkeleton() {
  return <PlatformPageSkeleton variant="timeline" titleWidth="w-80" descriptionWidth="w-[32rem]" />;
}

export function CategoriesLoadingSkeleton() {
  return <PlatformPageSkeleton titleWidth="w-80" descriptionWidth="w-[30rem]" sections={6} />;
}

export function SecurityLoadingSkeleton() {
  return <PlatformPageSkeleton variant="settings" titleWidth="w-80" descriptionWidth="w-[34rem]" />;
}
