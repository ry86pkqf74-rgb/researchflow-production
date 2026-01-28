interface SkeletonTimelineProps {
  items?: number;
  animated?: boolean;
}

export function SkeletonTimeline({
  items = 5,
  animated = true,
}: SkeletonTimelineProps) {
  return (
    <div className="space-y-6" data-testid="skeleton-timeline">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {/* Timeline marker */}
          <div className="flex flex-col items-center">
            <div
              className={`w-4 h-4 rounded-full bg-muted border-2 border-muted ${
                animated ? "animate-pulse" : ""
              }`}
            />
            {i < items - 1 && <div className="w-1 h-12 bg-muted mt-2" />}
          </div>

          {/* Timeline content */}
          <div className="flex-1 pt-1 space-y-2">
            <div
              className={`h-4 bg-muted rounded w-1/3 ${
                animated ? "animate-pulse" : ""
              }`}
            />
            <div
              className={`h-4 bg-muted rounded w-full ${
                animated ? "animate-pulse" : ""
              }`}
            />
            <div
              className={`h-4 bg-muted rounded w-2/3 ${
                animated ? "animate-pulse" : ""
              }`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
