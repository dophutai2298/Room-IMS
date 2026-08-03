import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function RoomDetailLoading() {
  return (
    <>
      <header className="space-y-3">
        <Skeleton className="h-8 w-44" />
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-12 w-80 max-w-full" />
          <Skeleton className="h-7 w-20 rounded-lg" />
        </div>
        <Skeleton className="h-5 w-[36rem] max-w-full" />
      </header>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-white/45 bg-background/35 p-4 clay-inset dark:border-white/8"
              >
                <Skeleton className="h-5 w-48" />
                <Skeleton className="mt-2 h-4 w-32" />
                <Skeleton className="mt-6 h-4 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-6 w-full" />
            ))}
            <Skeleton className="h-10 w-full rounded-xl" />
          </CardContent>
        </Card>
      </section>
    </>
  );
}
