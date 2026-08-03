import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function RoomsLoading() {
  return (
    <>
      <header className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-12 w-72 max-w-full" />
        <Skeleton className="h-5 w-[34rem] max-w-full" />
      </header>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <Skeleton className="h-7 w-20 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/40 bg-background/35 p-4 clay-inset dark:border-white/8">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </section>
    </>
  );
}
