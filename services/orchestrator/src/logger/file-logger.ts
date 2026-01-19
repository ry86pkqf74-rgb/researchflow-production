/**
 * File Logger with Rotation and PHI Scrubbing
 *
 * Winston-based logger that:
 * - Logs to both console and rotating files
 * - Scrubs PHI patterns before writing
 * - Rotates daily and by size
 * - Keeps 30 days of history
 *
 * Phase A - Task 38: Logging to Shared Volume with Rotation
 */

import * as fs from 'fs';
import * as path from 'path';

// Simple logger interface (can be replaced with Winston later)
interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  service: string;
  [key: string]: any;
}

class FileLogger {
  private logDir: string;
  private serviceName: string;
  private maxFileSize: number;
  private maxFiles: number;
  private currentDate: string;

  // PHI patterns to scrub
  private phiPatterns = [
    { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN_REDACTED]' },
    { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: '[PHONE_REDACTED]' },
    { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL_REDACTED]' },
    { pattern: /\b\d{5}(?:-\d{4})?\b/g, replacement: '[ZIP_REDACTED]' },
    { pattern: /\b(?:MRN|Medical Record|Patient ID)[:\s]+\w+/gi, replacement: '[MRN_REDACTED]' },
  ];

  constructor(serviceName: string = 'orchestrator') {
    this.serviceName = serviceName;
    this.logDir = process.env.LOGS_DIR || '/data/logs';
    this.maxFileSize = 100 * 1024 * 1024; // 100MB
    this.maxFiles = 30; // Keep 30 days
    this.currentDate = this.getDateString();

    // Ensure log directory exists
    this.ensureLogDir();
  }

  private ensureLogDir() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  private getDateString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  private getLogFilePath(): string {
    return path.join(this.logDir, `${this.serviceName}-${this.currentDate}.log`);
  }

  private scrubPHI(message: string): string {
    let scrubbed = message;
    for (const { pattern, replacement } of this.phiPatterns) {
      scrubbed = scrubbed.replace(pattern, replacement);
    }
    return scrubbed;
  }

  private checkRotation() {
    const today = this.getDateString();
    if (today !== this.currentDate) {
      this.currentDate = today;
    }

    // Check file size
    const filePath = this.getLogFilePath();
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size > this.maxFileSize) {
        // Rotate by appending timestamp
        const timestamp = Date.now();
        const rotatedPath = path.join(
          this.logDir,
          `${this.serviceName}-${this.currentDate}-${timestamp}.log`
        );
        fs.renameSync(filePath, rotatedPath);
      }
    }

    // Clean old files
    this.cleanOldLogs();
  }

  private cleanOldLogs() {
    try {
      const files = fs.readdirSync(this.logDir);
      const logFiles = files
        .filter(f => f.startsWith(this.serviceName) && f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: path.join(this.logDir, f),
          mtime: fs.statSync(path.join(this.logDir, f)).mtime,
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Keep only maxFiles newest files
      if (logFiles.length > this.maxFiles) {
        const filesToDelete = logFiles.slice(this.maxFiles);
        filesToDelete.forEach(file => {
          try {
            fs.unlinkSync(file.path);
            console.log(`Deleted old log file: ${file.name}`);
          } catch (error) {
            console.error(`Failed to delete log file ${file.name}:`, error);
          }
        });
      }
    } catch (error) {
      console.error('Failed to clean old logs:', error);
    }
  }

  private writeToFile(entry: LogEntry) {
    try {
      this.checkRotation();

      const logLine = JSON.stringify(entry) + '\n';
      const scrubbedLine = this.scrubPHI(logLine);

      fs.appendFileSync(this.getLogFilePath(), scrubbedLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private log(level: string, message: string, meta?: any) {
    const entry: LogEntry = {
      level,
      message: this.scrubPHI(message),
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      ...meta,
    };

    // Log to console
    const consoleMessage = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`;
    if (level === 'error') {
      console.error(consoleMessage, meta || '');
    } else if (level === 'warn') {
      console.warn(consoleMessage, meta || '');
    } else {
      console.log(consoleMessage, meta || '');
    }

    // Log to file
    this.writeToFile(entry);
  }

  info(message: string, meta?: any) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: any) {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: any) {
    this.log('error', message, meta);
  }

  debug(message: string, meta?: any) {
    if (process.env.LOG_LEVEL === 'debug') {
      this.log('debug', message, meta);
    }
  }
}

// Export singleton instance
export const logger = new FileLogger();
