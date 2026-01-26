export type FileFormat = 'csv' | 'excel' | 'json' | 'unknown';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface FileMetadata {
  rowCount: number;
  columnCount: number;
  columns: string[];
  sampleData: Record<string, unknown>[];
  format: FileFormat;
  sizeBytes: number;
}

export const MAX_FILE_SIZE = 50 * 1024 * 1024;

const MIME_TYPE_MAP: Record<string, FileFormat> = {
  'text/csv': 'csv',
  'application/csv': 'csv',
  'text/plain': 'csv',
  'application/json': 'json',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'application/vnd.ms-excel': 'excel'
};

const EXTENSION_MAP: Record<string, FileFormat> = {
  '.csv': 'csv',
  '.json': 'json',
  '.xlsx': 'excel',
  '.xls': 'excel'
};

export function detectFileFormat(file: UploadedFile): FileFormat {
  const mimeFormat = MIME_TYPE_MAP[file.mimetype.toLowerCase()];
  if (mimeFormat) {
    return mimeFormat;
  }

  const filename = file.originalname.toLowerCase();
  for (const [ext, format] of Object.entries(EXTENSION_MAP)) {
    if (filename.endsWith(ext)) {
      return format;
    }
  }

  return 'unknown';
}

export function validateFileSize(file: UploadedFile): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit.`
    };
  }
  return { valid: true };
}

function parseCSV(content: string): { columns: string[]; rows: string[][] } {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) {
    return { columns: [], rows: [] };
  }

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
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
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const columns = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);

  return { columns, rows };
}

function parseJSON(content: string): { columns: string[]; data: Record<string, unknown>[] } {
  const parsed = JSON.parse(content);
  
  const data = Array.isArray(parsed) ? parsed : [parsed];
  
  const columnSet = new Set<string>();
  for (const row of data) {
    if (typeof row === 'object' && row !== null) {
      Object.keys(row).forEach(key => columnSet.add(key));
    }
  }
  
  return {
    columns: Array.from(columnSet),
    data: data as Record<string, unknown>[]
  };
}

export function extractMetadata(file: UploadedFile, format: FileFormat): FileMetadata {
  const baseMetadata = {
    format,
    sizeBytes: file.size
  };

  if (format === 'csv') {
    const content = file.buffer.toString('utf-8');
    const { columns, rows } = parseCSV(content);
    const sampleRows = rows.slice(0, 5);
    
    const sampleData = sampleRows.map(row => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx] ?? null;
      });
      return obj;
    });

    return {
      ...baseMetadata,
      rowCount: rows.length,
      columnCount: columns.length,
      columns,
      sampleData
    };
  }

  if (format === 'json') {
    try {
      const content = file.buffer.toString('utf-8');
      const { columns, data } = parseJSON(content);
      
      return {
        ...baseMetadata,
        rowCount: data.length,
        columnCount: columns.length,
        columns,
        sampleData: data.slice(0, 5)
      };
    } catch {
      return {
        ...baseMetadata,
        rowCount: 0,
        columnCount: 0,
        columns: [],
        sampleData: []
      };
    }
  }

  if (format === 'excel') {
    return {
      ...baseMetadata,
      rowCount: 0,
      columnCount: 0,
      columns: [],
      sampleData: []
    };
  }

  return {
    ...baseMetadata,
    rowCount: 0,
    columnCount: 0,
    columns: [],
    sampleData: []
  };
}

export function validateUpload(file: UploadedFile): { 
  valid: boolean; 
  format: FileFormat; 
  error?: string 
} {
  const format = detectFileFormat(file);
  
  if (format === 'unknown') {
    return {
      valid: false,
      format,
      error: 'Unsupported file format. Please upload CSV, JSON, or Excel files.'
    };
  }

  const sizeValidation = validateFileSize(file);
  if (!sizeValidation.valid) {
    return {
      valid: false,
      format,
      error: sizeValidation.error
    };
  }

  return { valid: true, format };
}
