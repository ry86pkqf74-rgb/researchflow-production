"""
Structured Logging Configuration for Clinical Data Extraction.

This module provides:
- JSON-formatted structured logging
- PHI-safe logging (scrubs sensitive data)
- Request correlation IDs
- Performance timing
- Log level management

Usage:
    from data_extraction.logging_config import configure_logging, get_logger
    
    configure_logging(level="INFO", json_format=True)
    logger = get_logger(__name__)
    
    logger.info("Extraction started", extra={
        "tier": "MINI",
        "cell_count": 100,
    })
"""

import logging
import logging.handlers
import sys
import os
import re
import json
import threading
from datetime import datetime
from typing import Dict, Any, Optional, List, Pattern
from contextvars import ContextVar
from functools import wraps
import time

# Context variable for request correlation
request_id_var: ContextVar[Optional[str]] = ContextVar('request_id', default=None)


# PHI patterns to scrub from logs
PHI_PATTERNS: List[Pattern] = [
    # SSN
    re.compile(r'\b\d{3}-\d{2}-\d{4}\b'),
    re.compile(r'\b\d{9}\b'),
    # Phone numbers
    re.compile(r'\b\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b'),
    # Email addresses
    re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'),
    # Dates of birth (various formats)
    re.compile(r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b'),
    # MRN patterns
    re.compile(r'\bMRN[:\s]*\d{6,10}\b', re.IGNORECASE),
    re.compile(r'\bMR[#:\s]*\d{6,10}\b', re.IGNORECASE),
    # Names with common patterns (Mr/Mrs/Dr followed by capitalized words)
    re.compile(r'\b(Mr|Mrs|Ms|Dr|Patient)[.\s]+[A-Z][a-z]+\s+[A-Z][a-z]+\b'),
    # Credit card numbers
    re.compile(r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b'),
]

PHI_REPLACEMENT = "[PHI_REDACTED]"


def scrub_phi(text: str) -> str:
    """
    Remove PHI patterns from text for safe logging.
    
    Args:
        text: Text that may contain PHI
    
    Returns:
        Text with PHI patterns replaced
    """
    if not isinstance(text, str):
        return text
    
    result = text
    for pattern in PHI_PATTERNS:
        result = pattern.sub(PHI_REPLACEMENT, result)
    
    return result


def scrub_dict(data: Dict[str, Any], max_depth: int = 10) -> Dict[str, Any]:
    """
    Recursively scrub PHI from a dictionary.
    
    Args:
        data: Dictionary that may contain PHI
        max_depth: Maximum recursion depth
    
    Returns:
        Dictionary with PHI scrubbed from string values
    """
    if max_depth <= 0:
        return data
    
    result = {}
    for key, value in data.items():
        # Skip known safe fields
        if key in ('timestamp', 'level', 'logger', 'request_id', 'duration_ms'):
            result[key] = value
        elif isinstance(value, str):
            result[key] = scrub_phi(value)
        elif isinstance(value, dict):
            result[key] = scrub_dict(value, max_depth - 1)
        elif isinstance(value, list):
            result[key] = [
                scrub_phi(v) if isinstance(v, str) else v
                for v in value
            ]
        else:
            result[key] = value
    
    return result


class PHISafeFormatter(logging.Formatter):
    """
    Log formatter that scrubs PHI from log messages.
    """
    
    def __init__(
        self,
        fmt: Optional[str] = None,
        datefmt: Optional[str] = None,
        scrub_phi: bool = True,
    ):
        super().__init__(fmt, datefmt)
        self.scrub_phi = scrub_phi
    
    def format(self, record: logging.LogRecord) -> str:
        # Scrub the message
        if self.scrub_phi and hasattr(record, 'msg'):
            record.msg = scrub_phi(str(record.msg))
        
        # Scrub args
        if self.scrub_phi and record.args:
            if isinstance(record.args, dict):
                record.args = scrub_dict(record.args)
            elif isinstance(record.args, tuple):
                record.args = tuple(
                    scrub_phi(str(a)) if isinstance(a, str) else a
                    for a in record.args
                )
        
        return super().format(record)


class JSONFormatter(logging.Formatter):
    """
    JSON log formatter with PHI scrubbing and context enrichment.
    """
    
    def __init__(
        self,
        scrub_phi: bool = True,
        include_timestamp: bool = True,
        include_request_id: bool = True,
    ):
        super().__init__()
        self.scrub_phi_enabled = scrub_phi
        self.include_timestamp = include_timestamp
        self.include_request_id = include_request_id
    
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "level": record.levelname,
            "logger": record.name,
            "message": scrub_phi(record.getMessage()) if self.scrub_phi_enabled else record.getMessage(),
        }
        
        # Add timestamp
        if self.include_timestamp:
            log_data["timestamp"] = datetime.utcnow().isoformat() + "Z"
        
        # Add request ID from context
        if self.include_request_id:
            req_id = request_id_var.get()
            if req_id:
                log_data["request_id"] = req_id
        
        # Add extra fields
        if hasattr(record, '__dict__'):
            for key, value in record.__dict__.items():
                if key not in (
                    'name', 'msg', 'args', 'created', 'filename', 'funcName',
                    'levelname', 'levelno', 'lineno', 'module', 'msecs',
                    'pathname', 'process', 'processName', 'relativeCreated',
                    'stack_info', 'exc_info', 'exc_text', 'thread', 'threadName',
                    'message', 'asctime'
                ):
                    if self.scrub_phi_enabled and isinstance(value, str):
                        log_data[key] = scrub_phi(value)
                    elif self.scrub_phi_enabled and isinstance(value, dict):
                        log_data[key] = scrub_dict(value)
                    else:
                        log_data[key] = value
        
        # Add exception info
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        # Add source location in debug mode
        if record.levelno <= logging.DEBUG:
            log_data["source"] = {
                "file": record.filename,
                "line": record.lineno,
                "function": record.funcName,
            }
        
        return json.dumps(log_data, default=str)


class ExtractionLogger(logging.LoggerAdapter):
    """
    Logger adapter with extraction-specific context.
    """
    
    def __init__(self, logger: logging.Logger, extra: Optional[Dict[str, Any]] = None):
        super().__init__(logger, extra or {})
    
    def process(self, msg: str, kwargs: Dict[str, Any]) -> tuple:
        # Add request ID if available
        req_id = request_id_var.get()
        if req_id:
            kwargs.setdefault('extra', {})['request_id'] = req_id
        
        # Merge with default extra
        if self.extra:
            kwargs.setdefault('extra', {}).update(self.extra)
        
        return msg, kwargs
    
    def extraction_start(
        self,
        tier: str,
        cell_count: int,
        columns: List[str],
        **kwargs,
    ):
        """Log extraction job start."""
        self.info(
            "Extraction job started",
            extra={
                "event": "extraction_start",
                "tier": tier,
                "cell_count": cell_count,
                "columns": columns,
                **kwargs,
            }
        )
    
    def extraction_complete(
        self,
        tier: str,
        successful: int,
        failed: int,
        phi_blocked: int,
        duration_ms: float,
        cost_usd: float,
        **kwargs,
    ):
        """Log extraction job completion."""
        self.info(
            "Extraction job completed",
            extra={
                "event": "extraction_complete",
                "tier": tier,
                "successful": successful,
                "failed": failed,
                "phi_blocked": phi_blocked,
                "duration_ms": duration_ms,
                "cost_usd": cost_usd,
                **kwargs,
            }
        )
    
    def extraction_error(
        self,
        tier: str,
        error_type: str,
        error_message: str,
        cell_id: Optional[str] = None,
        **kwargs,
    ):
        """Log extraction error."""
        self.error(
            f"Extraction error: {error_type}",
            extra={
                "event": "extraction_error",
                "tier": tier,
                "error_type": error_type,
                "error_message": scrub_phi(error_message),
                "cell_id": cell_id,
                **kwargs,
            }
        )
    
    def phi_detected(
        self,
        cell_id: str,
        phi_types: List[str],
        blocked: bool,
        **kwargs,
    ):
        """Log PHI detection event."""
        self.warning(
            "PHI detected in cell",
            extra={
                "event": "phi_detected",
                "cell_id": cell_id,
                "phi_types": phi_types,
                "blocked": blocked,
                **kwargs,
            }
        )


def configure_logging(
    level: str = "INFO",
    json_format: bool = True,
    scrub_phi: bool = True,
    log_file: Optional[str] = None,
    max_bytes: int = 10 * 1024 * 1024,  # 10MB
    backup_count: int = 5,
) -> logging.Logger:
    """
    Configure logging for the extraction module.
    
    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        json_format: Use JSON formatting
        scrub_phi: Enable PHI scrubbing
        log_file: Optional file path for log output
        max_bytes: Max size per log file (for rotation)
        backup_count: Number of backup files to keep
    
    Returns:
        Configured root logger
    """
    # Get or create logger
    logger = logging.getLogger("data_extraction")
    logger.setLevel(getattr(logging, level.upper()))
    
    # Remove existing handlers
    logger.handlers.clear()
    
    # Create formatter
    if json_format:
        formatter = JSONFormatter(scrub_phi=scrub_phi)
    else:
        fmt = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
        formatter = PHISafeFormatter(fmt=fmt, scrub_phi=scrub_phi)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # File handler (optional)
    if log_file:
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=max_bytes,
            backupCount=backup_count,
        )
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    # Don't propagate to root logger
    logger.propagate = False
    
    logger.info(
        "Logging configured",
        extra={
            "level": level,
            "json_format": json_format,
            "scrub_phi": scrub_phi,
            "log_file": log_file,
        }
    )
    
    return logger


def get_logger(name: str, **extra) -> ExtractionLogger:
    """
    Get a logger for a specific module.
    
    Args:
        name: Module name (typically __name__)
        **extra: Default extra fields to include in all logs
    
    Returns:
        ExtractionLogger instance
    """
    logger = logging.getLogger(f"data_extraction.{name}")
    return ExtractionLogger(logger, extra)


def set_request_id(request_id: str):
    """Set the request ID for the current context."""
    request_id_var.set(request_id)


def get_request_id() -> Optional[str]:
    """Get the current request ID."""
    return request_id_var.get()


def with_request_id(func):
    """Decorator to generate and set request ID for a function."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        import uuid
        request_id = f"req_{uuid.uuid4().hex[:16]}"
        set_request_id(request_id)
        return func(*args, **kwargs)
    return wrapper


def log_duration(logger: logging.Logger, operation: str):
    """Decorator to log operation duration."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start = time.time()
            try:
                result = func(*args, **kwargs)
                duration_ms = (time.time() - start) * 1000
                logger.info(
                    f"{operation} completed",
                    extra={
                        "operation": operation,
                        "duration_ms": duration_ms,
                        "success": True,
                    }
                )
                return result
            except Exception as e:
                duration_ms = (time.time() - start) * 1000
                logger.error(
                    f"{operation} failed: {type(e).__name__}",
                    extra={
                        "operation": operation,
                        "duration_ms": duration_ms,
                        "success": False,
                        "error_type": type(e).__name__,
                    }
                )
                raise
        return wrapper
    return decorator


# Exports
__all__ = [
    "configure_logging",
    "get_logger",
    "set_request_id",
    "get_request_id",
    "with_request_id",
    "log_duration",
    "scrub_phi",
    "scrub_dict",
    "PHISafeFormatter",
    "JSONFormatter",
    "ExtractionLogger",
]
