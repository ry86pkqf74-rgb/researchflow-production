import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SkeletonTableProps {
  columns?: number;
  rows?: number;
  animated?: boolean;
}

export function SkeletonTable({
  columns = 4,
  rows = 5,
  animated = true,
}: SkeletonTableProps) {
  return (
    <div className="border rounded-md" data-testid="skeleton-table">
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: columns }).map((_, i) => (
              <TableHead key={i}>
                <div
                  className={`h-4 bg-muted rounded w-full ${
                    animated ? "animate-pulse" : ""
                  }`}
                />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <TableCell key={colIndex}>
                  <div
                    className={`h-4 bg-muted rounded ${
                      animated ? "animate-pulse" : ""
                    } ${colIndex === columns - 1 ? "w-4/5" : "w-full"}`}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
