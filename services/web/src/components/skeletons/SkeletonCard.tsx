import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface SkeletonCardProps {
  lines?: number;
  animated?: boolean;
}

export function SkeletonCard({ lines = 3, animated = true }: SkeletonCardProps) {
  return (
    <Card data-testid="skeleton-card">
      <CardHeader>
        <div
          className={`h-6 bg-muted rounded w-3/4 ${
            animated ? "animate-pulse" : ""
          }`}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`h-4 bg-muted rounded ${
              animated ? "animate-pulse" : ""
            } ${i === lines - 1 ? "w-4/5" : "w-full"}`}
          />
        ))}
      </CardContent>
    </Card>
  );
}
