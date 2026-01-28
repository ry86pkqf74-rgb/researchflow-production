/**
 * ART-005: CSV Table Preview Component
 * Parse and display as table
 * Sortable columns, pagination for large files
 */

import React, { useState, useMemo } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CSVPreviewProps {
  content: string;
  maxHeight?: string;
  rowsPerPage?: number;
  className?: string;
}

type SortOrder = 'asc' | 'desc' | null;

export function CSVPreview({
  content,
  maxHeight = 'max-h-96',
  rowsPerPage = 50,
  className,
}: CSVPreviewProps) {
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);
  const [currentPage, setCurrentPage] = useState(0);

  // Parse CSV
  const { headers, rows } = useMemo(() => {
    const lines = content.trim().split('\n');
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseRow = (line: string) => {
      // Simple CSV parsing (handles basic cases)
      const cells: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          cells.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }

      cells.push(current.trim());
      return cells;
    };

    return {
      headers: parseRow(lines[0]),
      rows: lines.slice(1).map(parseRow),
    };
  }, [content]);

  // Sort rows
  const sortedRows = useMemo(() => {
    if (sortColumn === null || sortOrder === null) return rows;

    return [...rows].sort((a, b) => {
      const aVal = a[sortColumn] || '';
      const bVal = b[sortColumn] || '';

      // Try numeric sort
      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
      }

      // Fallback to string sort
      const cmp = aVal.localeCompare(bVal);
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortColumn, sortOrder]);

  // Paginate rows
  const paginatedRows = useMemo(() => {
    const start = currentPage * rowsPerPage;
    return sortedRows.slice(start, start + rowsPerPage);
  }, [sortedRows, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(sortedRows.length / rowsPerPage);

  const handleSort = (colIndex: number) => {
    if (sortColumn === colIndex) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else if (sortOrder === 'desc') {
        setSortOrder(null);
        setSortColumn(null);
      }
    } else {
      setSortColumn(colIndex);
      setSortOrder('asc');
    }
    setCurrentPage(0);
  };

  if (headers.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No data available
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between px-2">
        <Badge variant="outline">
          {sortedRows.length} rows × {headers.length} columns
        </Badge>
        {sortedRows.length > rowsPerPage && (
          <span className="text-xs text-muted-foreground">
            Showing {currentPage * rowsPerPage + 1} to{' '}
            {Math.min((currentPage + 1) * rowsPerPage, sortedRows.length)} of{' '}
            {sortedRows.length}
          </span>
        )}
      </div>

      <ScrollArea className={cn(maxHeight, 'border rounded-md')}>
        <table className="w-full text-sm border-collapse">
          <thead className="bg-muted sticky top-0 z-10">
            <tr>
              {headers.map((header, i) => (
                <th
                  key={i}
                  className="px-4 py-2 text-left font-medium border-b cursor-pointer hover:bg-accent/50 transition-colors whitespace-nowrap"
                  onClick={() => handleSort(i)}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate">{header}</span>
                    {sortColumn === i && (
                      <span>
                        {sortOrder === 'asc' ? (
                          <ChevronUp className="h-4 w-4 text-primary" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-primary" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="border-b hover:bg-accent/30 transition-colors"
              >
                {row.map((cell, colIdx) => (
                  <td
                    key={colIdx}
                    className="px-4 py-2 truncate max-w-xs"
                    title={cell}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(0)}
            disabled={currentPage === 0}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="text-sm text-muted-foreground min-w-[60px] text-center">
            {currentPage + 1} of {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage === totalPages - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(totalPages - 1)}
            disabled={currentPage === totalPages - 1}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default CSVPreview;
