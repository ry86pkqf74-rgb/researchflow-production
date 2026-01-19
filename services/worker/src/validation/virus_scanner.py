"""
ClamAV Virus Scanner Integration
Phase A - Task 11: Unzip + Virus Scan with ClamAV

Provides virus scanning capabilities using ClamAV daemon.
Fail-closed: All files must be scanned before processing.
"""

import os
import socket
import struct
from typing import List, Optional
from dataclasses import dataclass
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

# ClamAV configuration
CLAMAV_HOST = os.getenv("CLAMAV_HOST", "clamav")
CLAMAV_PORT = int(os.getenv("CLAMAV_PORT", "3310"))
SCAN_TIMEOUT = 300  # 5 minutes for large files


@dataclass(frozen=True)
class VirusScanResult:
    """Result of virus scan"""
    safe: bool
    threats_found: List[str]
    scan_duration_ms: Optional[int] = None
    file_path: Optional[str] = None


class VirusScanError(RuntimeError):
    """Raised when virus scan fails (fail-closed)"""
    pass


class VirusScanner:
    """
    ClamAV virus scanner client

    Following ResearchFlow patterns:
    - Fail-closed: Raises exceptions if scan fails
    - Socket-based communication with ClamAV daemon
    - Supports file and stream scanning
    """

    def __init__(self, host: str = CLAMAV_HOST, port: int = CLAMAV_PORT):
        self.host = host
        self.port = port

    def scan_file(self, file_path: str) -> VirusScanResult:
        """
        Scan file for viruses using ClamAV

        Args:
            file_path: Path to file to scan

        Returns:
            VirusScanResult indicating if file is safe

        Raises:
            VirusScanError: If scan fails (fail-closed)
        """
        if not os.path.exists(file_path):
            raise VirusScanError(f"File not found: {file_path}")

        if os.path.getsize(file_path) == 0:
            logger.warning(f"Empty file, skipping scan: {file_path}")
            return VirusScanResult(safe=True, threats_found=[], file_path=file_path)

        try:
            logger.info(f"Scanning file: {file_path}")

            # Use INSTREAM command for scanning
            # This is more reliable than SCAN for Docker setups
            scan_result = self._scan_stream(file_path)

            if scan_result.startswith("stream: OK"):
                logger.info(f"File is clean: {file_path}")
                return VirusScanResult(
                    safe=True,
                    threats_found=[],
                    file_path=file_path
                )

            elif "FOUND" in scan_result:
                # Extract threat name
                threat_name = scan_result.split("stream:")[1].split("FOUND")[0].strip()
                logger.warning(f"Virus detected in {file_path}: {threat_name}")

                return VirusScanResult(
                    safe=False,
                    threats_found=[threat_name],
                    file_path=file_path
                )

            else:
                raise VirusScanError(f"Unexpected scan result: {scan_result}")

        except socket.timeout:
            raise VirusScanError(f"Virus scan timeout for {file_path}")

        except ConnectionRefusedError:
            raise VirusScanError(
                f"Cannot connect to ClamAV daemon at {self.host}:{self.port}"
            )

        except Exception as e:
            raise VirusScanError(f"Virus scan failed for {file_path}: {e}")

    def scan_files(self, file_paths: List[str]) -> List[VirusScanResult]:
        """
        Scan multiple files for viruses

        Args:
            file_paths: List of file paths to scan

        Returns:
            List of VirusScanResult for each file

        Raises:
            VirusScanError: If any scan fails (fail-closed)
        """
        results = []

        for file_path in file_paths:
            result = self.scan_file(file_path)
            results.append(result)

            # Fail-closed: Stop on first virus detection
            if not result.safe:
                raise VirusScanError(
                    f"Virus detected in {file_path}: {result.threats_found}"
                )

        return results

    def ping(self) -> bool:
        """
        Check if ClamAV daemon is responsive

        Returns:
            True if daemon responds, False otherwise
        """
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            sock.connect((self.host, self.port))

            # Send PING command
            sock.sendall(b"zPING\0")
            response = sock.recv(1024).decode('utf-8').strip()

            sock.close()

            return response == "PONG"

        except Exception as e:
            logger.warning(f"ClamAV ping failed: {e}")
            return False

    def _scan_stream(self, file_path: str) -> str:
        """
        Scan file using INSTREAM command

        This sends the file content over the socket, which works
        better in Docker environments where file paths may not be shared.

        Args:
            file_path: Path to file to scan

        Returns:
            Scan result string from ClamAV

        Raises:
            VirusScanError: If scan fails
        """
        try:
            # Connect to ClamAV daemon
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(SCAN_TIMEOUT)
            sock.connect((self.host, self.port))

            # Send INSTREAM command
            sock.sendall(b"zINSTREAM\0")

            # Stream file data in chunks
            with open(file_path, 'rb') as f:
                while True:
                    chunk = f.read(8192)  # 8KB chunks
                    if not chunk:
                        break

                    # Send chunk size (4 bytes, network byte order)
                    size = struct.pack('!L', len(chunk))
                    sock.sendall(size + chunk)

            # Send zero-length chunk to signal end of stream
            sock.sendall(struct.pack('!L', 0))

            # Receive scan result
            result = b""
            while True:
                chunk = sock.recv(4096)
                if not chunk:
                    break
                result += chunk

            sock.close()

            return result.decode('utf-8').strip()

        except Exception as e:
            raise VirusScanError(f"Stream scan failed: {e}")


def scan_file(file_path: str) -> VirusScanResult:
    """
    Convenience function to scan a single file

    Args:
        file_path: Path to file to scan

    Returns:
        VirusScanResult

    Raises:
        VirusScanError: If scan fails (fail-closed)
    """
    scanner = VirusScanner()
    return scanner.scan_file(file_path)


def quarantine_file(file_path: str, reason: str) -> str:
    """
    Move file to quarantine directory

    Args:
        file_path: Path to file to quarantine
        reason: Reason for quarantine (virus name)

    Returns:
        Path to quarantined file
    """
    quarantine_dir = "/data/.tmp/quarantine"
    os.makedirs(quarantine_dir, exist_ok=True)

    # Generate quarantine path
    file_name = Path(file_path).name
    quarantine_path = os.path.join(quarantine_dir, f"{file_name}.quarantine")

    # Move file to quarantine
    os.rename(file_path, quarantine_path)

    # Create quarantine metadata
    metadata_path = f"{quarantine_path}.json"
    import json
    from datetime import datetime

    metadata = {
        "original_path": file_path,
        "quarantine_path": quarantine_path,
        "reason": reason,
        "quarantined_at": datetime.utcnow().isoformat(),
        "action": "quarantined"
    }

    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)

    # Set read-only permissions
    os.chmod(quarantine_path, 0o400)

    logger.warning(f"File quarantined: {file_path} -> {quarantine_path} (reason: {reason})")

    return quarantine_path
