"""
File Logger with Rotation and PHI Scrubbing

Logging handler that:
- Logs to both console and rotating files
- Scrubs PHI patterns before writing
- Rotates daily and by size
- Keeps 30 days of history

Phase A - Task 38: Logging to Shared Volume with Rotation
"""

import os
import re
import json
import logging
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
from datetime import datetime
from typing import Dict, List, Tuple
from pathlib import Path


class PHIScrubFilter(logging.Filter):
    """Filter that scrubs PHI patterns from log messages"""

    # PHI patterns to scrub
    PHI_PATTERNS: List[Tuple[re.Pattern, str]] = [
        (re.compile(r'\b\d{3}-\d{2}-\d{4}\b'), '[SSN_REDACTED]'),
        (re.compile(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b'), '[PHONE_REDACTED]'),
        (re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'), '[EMAIL_REDACTED]'),
        (re.compile(r'\b\d{5}(?:-\d{4})?\b'), '[ZIP_REDACTED]'),
        (re.compile(r'\b(?:MRN|Medical Record|Patient ID)[:\s]+\w+', re.IGNORECASE), '[MRN_REDACTED]'),
        (re.compile(r'\b(?:DOB|Date of Birth)[:\s]+[\d/-]+', re.IGNORECASE), '[DOB_REDACTED]'),
    ]

    def filter(self, record: logging.LogRecord) -> bool:
        """Scrub PHI from log record"""
        # Scrub message
        if isinstance(record.msg, str):
            for pattern, replacement in self.PHI_PATTERNS:
                record.msg = pattern.sub(replacement, record.msg)

        # Scrub args if present
        if record.args:
            scrubbed_args = []
            for arg in record.args:
                if isinstance(arg, str):
                    for pattern, replacement in self.PHI_PATTERNS:
                        arg = pattern.sub(replacement, arg)
                scrubbed_args.append(arg)
            record.args = tuple(scrubbed_args)

        return True


class JSONFormatter(logging.Formatter):
    """Format log records as JSON"""

    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'level': record.levelname,
            'service': 'worker',
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
        }

        # Add exception info if present
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)

        # Add extra fields
        if hasattr(record, 'extra'):
            log_data.update(record.extra)

        return json.dumps(log_data)


def setup_logger(
    name: str = 'worker',
    log_dir: str = None,
    log_level: str = None,
    max_bytes: int = 100 * 1024 * 1024,  # 100MB
    backup_count: int = 30,
) -> logging.Logger:
    """
    Setup logger with file rotation and PHI scrubbing

    Args:
        name: Logger name
        log_dir: Directory for log files (default: /data/logs)
        log_level: Logging level (default: INFO)
        max_bytes: Max size per log file before rotation
        backup_count: Number of backup files to keep

    Returns:
        Configured logger instance
    """
    # Get configuration from environment
    log_dir = log_dir or os.getenv('LOGS_DIR', '/data/logs')
    log_level = log_level or os.getenv('LOG_LEVEL', 'INFO').upper()

    # Ensure log directory exists
    Path(log_dir).mkdir(parents=True, exist_ok=True)

    # Create logger
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, log_level))

    # Remove existing handlers to avoid duplicates
    logger.handlers.clear()

    # Console handler (for container logs)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(getattr(logging, log_level))

    # Use simple format for console
    console_format = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(console_format)
    console_handler.addFilter(PHIScrubFilter())
    logger.addHandler(console_handler)

    # File handler with rotation by size
    try:
        log_file = os.path.join(log_dir, f'{name}.log')
        file_handler = RotatingFileHandler(
            log_file,
            maxBytes=max_bytes,
            backupCount=backup_count,
            encoding='utf-8'
        )
        file_handler.setLevel(getattr(logging, log_level))

        # Use JSON format for files
        file_handler.setFormatter(JSONFormatter())
        file_handler.addFilter(PHIScrubFilter())
        logger.addHandler(file_handler)
    except Exception as e:
        logger.error(f"Failed to setup file logging: {e}")

    # Daily rotating file handler
    try:
        daily_log_file = os.path.join(log_dir, f'{name}-daily.log')
        daily_handler = TimedRotatingFileHandler(
            daily_log_file,
            when='midnight',
            interval=1,
            backupCount=backup_count,
            encoding='utf-8'
        )
        daily_handler.setLevel(getattr(logging, log_level))
        daily_handler.setFormatter(JSONFormatter())
        daily_handler.addFilter(PHIScrubFilter())
        logger.addHandler(daily_handler)
    except Exception as e:
        logger.error(f"Failed to setup daily rotating log: {e}")

    return logger


# Create singleton logger instance
logger = setup_logger()


def get_logger(name: str = None) -> logging.Logger:
    """
    Get logger instance

    Args:
        name: Logger name (default: use root worker logger)

    Returns:
        Logger instance
    """
    if name:
        return logging.getLogger(f'worker.{name}')
    return logger
