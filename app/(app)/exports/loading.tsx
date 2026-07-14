import { PlatformPageSkeleton } from "@/components/ui/PlatformLoading";

export default function Loading() {
  return <PlatformPageSkeleton titleWidth="w-64" descriptionWidth="w-[32rem]" sections={5} />;
}
