"""
Artifact Compression Service

Provides compression and decompression for stored artifacts:
- Multiple compression algorithms (gzip, lz4, zstd)
- Automatic algorithm selection based on content type
- Streaming compression for large files
- Compression statistics and monitoring
"""

import gzip
import zlib
import hashlib
import io
import os
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, Union, BinaryIO, Tuple
from datetime import datetime
from pathlib import Path
from enum import Enum

try:
    import lz4.frame as lz4
    LZ4_AVAILABLE = True
except ImportError:
    LZ4_AVAILABLE = False

try:
    import zstandard as zstd
    ZSTD_AVAILABLE = True
except ImportError:
    ZSTD_AVAILABLE = False


class CompressionAlgorithm(Enum):
    """Supported compression algorithms"""
    NONE = "none"
    GZIP = "gzip"
    ZLIB = "zlib"
    LZ4 = "lz4"
    ZSTD = "zstd"


@dataclass
class CompressionResult:
    """Result of compression operation"""
    algorithm: CompressionAlgorithm
    original_size: int
    compressed_size: int
    compression_ratio: float
    checksum: str
    compressed_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    @property
    def space_saved(self) -> int:
        """Bytes saved by compression"""
        return self.original_size - self.compressed_size

    @property
    def space_saved_percent(self) -> float:
        """Percentage of space saved"""
        if self.original_size == 0:
            return 0.0
        return (self.space_saved / self.original_size) * 100


@dataclass
class CompressionConfig:
    """Configuration for compression service"""
    default_algorithm: CompressionAlgorithm = CompressionAlgorithm.ZSTD
    fallback_algorithm: CompressionAlgorithm = CompressionAlgorithm.GZIP

    # Compression levels (higher = more compression, slower)
    gzip_level: int = 6  # 1-9
    zlib_level: int = 6  # 1-9
    lz4_level: int = 0   # 0-16 (0 = fast)
    zstd_level: int = 3  # 1-22

    # Size thresholds
    min_size_for_compression: int = 1024  # Don't compress files < 1KB
    chunk_size: int = 64 * 1024  # 64KB chunks for streaming

    # Content type preferences
    algorithm_by_content_type: Dict[str, CompressionAlgorithm] = field(
        default_factory=lambda: {
            "application/json": CompressionAlgorithm.ZSTD,
            "text/plain": CompressionAlgorithm.GZIP,
            "application/octet-stream": CompressionAlgorithm.LZ4,
            "image/png": CompressionAlgorithm.NONE,  # Already compressed
            "image/jpeg": CompressionAlgorithm.NONE,
            "application/zip": CompressionAlgorithm.NONE,
            "application/gzip": CompressionAlgorithm.NONE,
        }
    )


class Compressor(ABC):
    """Abstract base class for compressors"""

    @abstractmethod
    def compress(self, data: bytes) -> bytes:
        """Compress data"""
        pass

    @abstractmethod
    def decompress(self, data: bytes) -> bytes:
        """Decompress data"""
        pass

    @abstractmethod
    def compress_stream(self, input_stream: BinaryIO, output_stream: BinaryIO) -> int:
        """Compress stream, returns compressed size"""
        pass

    @abstractmethod
    def decompress_stream(self, input_stream: BinaryIO, output_stream: BinaryIO) -> int:
        """Decompress stream, returns decompressed size"""
        pass


class GzipCompressor(Compressor):
    """GZIP compression"""

    def __init__(self, level: int = 6):
        self.level = level

    def compress(self, data: bytes) -> bytes:
        return gzip.compress(data, compresslevel=self.level)

    def decompress(self, data: bytes) -> bytes:
        return gzip.decompress(data)

    def compress_stream(self, input_stream: BinaryIO, output_stream: BinaryIO) -> int:
        with gzip.GzipFile(fileobj=output_stream, mode='wb', compresslevel=self.level) as f:
            while chunk := input_stream.read(64 * 1024):
                f.write(chunk)
        return output_stream.tell()

    def decompress_stream(self, input_stream: BinaryIO, output_stream: BinaryIO) -> int:
        with gzip.GzipFile(fileobj=input_stream, mode='rb') as f:
            while chunk := f.read(64 * 1024):
                output_stream.write(chunk)
        return output_stream.tell()


class ZlibCompressor(Compressor):
    """ZLIB compression"""

    def __init__(self, level: int = 6):
        self.level = level

    def compress(self, data: bytes) -> bytes:
        return zlib.compress(data, level=self.level)

    def decompress(self, data: bytes) -> bytes:
        return zlib.decompress(data)

    def compress_stream(self, input_stream: BinaryIO, output_stream: BinaryIO) -> int:
        compressor = zlib.compressobj(level=self.level)
        while chunk := input_stream.read(64 * 1024):
            output_stream.write(compressor.compress(chunk))
        output_stream.write(compressor.flush())
        return output_stream.tell()

    def decompress_stream(self, input_stream: BinaryIO, output_stream: BinaryIO) -> int:
        decompressor = zlib.decompressobj()
        while chunk := input_stream.read(64 * 1024):
            output_stream.write(decompressor.decompress(chunk))
        output_stream.write(decompressor.flush())
        return output_stream.tell()


class Lz4Compressor(Compressor):
    """LZ4 compression (fast)"""

    def __init__(self, level: int = 0):
        if not LZ4_AVAILABLE:
            raise ImportError("lz4 package not installed")
        self.level = level

    def compress(self, data: bytes) -> bytes:
        return lz4.compress(data, compression_level=self.level)

    def decompress(self, data: bytes) -> bytes:
        return lz4.decompress(data)

    def compress_stream(self, input_stream: BinaryIO, output_stream: BinaryIO) -> int:
        with lz4.LZ4FrameFile(output_stream, mode='wb', compression_level=self.level) as f:
            while chunk := input_stream.read(64 * 1024):
                f.write(chunk)
        return output_stream.tell()

    def decompress_stream(self, input_stream: BinaryIO, output_stream: BinaryIO) -> int:
        with lz4.LZ4FrameFile(input_stream, mode='rb') as f:
            while chunk := f.read(64 * 1024):
                output_stream.write(chunk)
        return output_stream.tell()


class ZstdCompressor(Compressor):
    """Zstandard compression (best ratio/speed balance)"""

    def __init__(self, level: int = 3):
        if not ZSTD_AVAILABLE:
            raise ImportError("zstandard package not installed")
        self.level = level
        self.ctx = zstd.ZstdCompressor(level=level)
        self.dctx = zstd.ZstdDecompressor()

    def compress(self, data: bytes) -> bytes:
        return self.ctx.compress(data)

    def decompress(self, data: bytes) -> bytes:
        return self.dctx.decompress(data)

    def compress_stream(self, input_stream: BinaryIO, output_stream: BinaryIO) -> int:
        self.ctx.copy_stream(input_stream, output_stream)
        return output_stream.tell()

    def decompress_stream(self, input_stream: BinaryIO, output_stream: BinaryIO) -> int:
        self.dctx.copy_stream(input_stream, output_stream)
        return output_stream.tell()


class NoCompressor(Compressor):
    """Pass-through (no compression)"""

    def compress(self, data: bytes) -> bytes:
        return data

    def decompress(self, data: bytes) -> bytes:
        return data

    def compress_stream(self, input_stream: BinaryIO, output_stream: BinaryIO) -> int:
        while chunk := input_stream.read(64 * 1024):
            output_stream.write(chunk)
        return output_stream.tell()

    def decompress_stream(self, input_stream: BinaryIO, output_stream: BinaryIO) -> int:
        while chunk := input_stream.read(64 * 1024):
            output_stream.write(chunk)
        return output_stream.tell()


class ArtifactCompressor:
    """
    Main compression service for artifacts.

    Handles:
    - Algorithm selection
    - In-memory and streaming compression
    - Metadata tracking
    - Statistics
    """

    def __init__(self, config: Optional[CompressionConfig] = None):
        self.config = config or CompressionConfig()
        self._compressors: Dict[CompressionAlgorithm, Compressor] = {}
        self._stats = {
            "total_compressed": 0,
            "total_decompressed": 0,
            "total_original_bytes": 0,
            "total_compressed_bytes": 0,
            "by_algorithm": {}
        }
        self._init_compressors()

    def _init_compressors(self) -> None:
        """Initialize available compressors"""
        self._compressors[CompressionAlgorithm.NONE] = NoCompressor()
        self._compressors[CompressionAlgorithm.GZIP] = GzipCompressor(self.config.gzip_level)
        self._compressors[CompressionAlgorithm.ZLIB] = ZlibCompressor(self.config.zlib_level)

        if LZ4_AVAILABLE:
            self._compressors[CompressionAlgorithm.LZ4] = Lz4Compressor(self.config.lz4_level)

        if ZSTD_AVAILABLE:
            self._compressors[CompressionAlgorithm.ZSTD] = ZstdCompressor(self.config.zstd_level)

    def _get_algorithm(
        self,
        content_type: Optional[str] = None,
        algorithm: Optional[CompressionAlgorithm] = None
    ) -> CompressionAlgorithm:
        """Determine best compression algorithm"""
        if algorithm and algorithm in self._compressors:
            return algorithm

        # Check content type preferences
        if content_type and content_type in self.config.algorithm_by_content_type:
            preferred = self.config.algorithm_by_content_type[content_type]
            if preferred in self._compressors:
                return preferred

        # Use default or fallback
        if self.config.default_algorithm in self._compressors:
            return self.config.default_algorithm

        return self.config.fallback_algorithm

    def _calculate_checksum(self, data: bytes) -> str:
        """Calculate SHA256 checksum"""
        return hashlib.sha256(data).hexdigest()

    def compress(
        self,
        data: bytes,
        content_type: Optional[str] = None,
        algorithm: Optional[CompressionAlgorithm] = None
    ) -> Tuple[bytes, CompressionResult]:
        """
        Compress data in memory.

        Args:
            data: Data to compress
            content_type: MIME type for algorithm selection
            algorithm: Force specific algorithm

        Returns:
            Tuple of (compressed_data, result)
        """
        original_size = len(data)

        # Skip compression for small files
        if original_size < self.config.min_size_for_compression:
            return data, CompressionResult(
                algorithm=CompressionAlgorithm.NONE,
                original_size=original_size,
                compressed_size=original_size,
                compression_ratio=1.0,
                checksum=self._calculate_checksum(data)
            )

        algo = self._get_algorithm(content_type, algorithm)
        compressor = self._compressors[algo]

        compressed = compressor.compress(data)
        compressed_size = len(compressed)

        # If compression didn't help, return original
        if compressed_size >= original_size:
            return data, CompressionResult(
                algorithm=CompressionAlgorithm.NONE,
                original_size=original_size,
                compressed_size=original_size,
                compression_ratio=1.0,
                checksum=self._calculate_checksum(data)
            )

        result = CompressionResult(
            algorithm=algo,
            original_size=original_size,
            compressed_size=compressed_size,
            compression_ratio=compressed_size / original_size,
            checksum=self._calculate_checksum(data)
        )

        # Update stats
        self._update_stats(algo, original_size, compressed_size)

        return compressed, result

    def decompress(
        self,
        data: bytes,
        algorithm: CompressionAlgorithm
    ) -> bytes:
        """
        Decompress data.

        Args:
            data: Compressed data
            algorithm: Algorithm used for compression

        Returns:
            Decompressed data
        """
        if algorithm == CompressionAlgorithm.NONE:
            return data

        compressor = self._compressors[algorithm]
        decompressed = compressor.decompress(data)

        self._stats["total_decompressed"] += 1
        return decompressed

    def compress_file(
        self,
        input_path: Union[str, Path],
        output_path: Union[str, Path],
        content_type: Optional[str] = None,
        algorithm: Optional[CompressionAlgorithm] = None
    ) -> CompressionResult:
        """
        Compress a file using streaming.

        Args:
            input_path: Path to input file
            output_path: Path to output file
            content_type: MIME type for algorithm selection
            algorithm: Force specific algorithm

        Returns:
            Compression result
        """
        input_path = Path(input_path)
        output_path = Path(output_path)

        original_size = input_path.stat().st_size

        # Skip compression for small files
        if original_size < self.config.min_size_for_compression:
            # Just copy the file
            import shutil
            shutil.copy2(input_path, output_path)
            return CompressionResult(
                algorithm=CompressionAlgorithm.NONE,
                original_size=original_size,
                compressed_size=original_size,
                compression_ratio=1.0,
                checksum=self._file_checksum(input_path)
            )

        algo = self._get_algorithm(content_type, algorithm)
        compressor = self._compressors[algo]

        # Stream compression
        with open(input_path, 'rb') as input_file:
            with open(output_path, 'wb') as output_file:
                compressor.compress_stream(input_file, output_file)

        compressed_size = output_path.stat().st_size

        # If compression didn't help, replace with original
        if compressed_size >= original_size:
            import shutil
            shutil.copy2(input_path, output_path)
            return CompressionResult(
                algorithm=CompressionAlgorithm.NONE,
                original_size=original_size,
                compressed_size=original_size,
                compression_ratio=1.0,
                checksum=self._file_checksum(input_path)
            )

        result = CompressionResult(
            algorithm=algo,
            original_size=original_size,
            compressed_size=compressed_size,
            compression_ratio=compressed_size / original_size,
            checksum=self._file_checksum(input_path)
        )

        self._update_stats(algo, original_size, compressed_size)
        return result

    def decompress_file(
        self,
        input_path: Union[str, Path],
        output_path: Union[str, Path],
        algorithm: CompressionAlgorithm
    ) -> int:
        """
        Decompress a file using streaming.

        Args:
            input_path: Path to compressed file
            output_path: Path to output file
            algorithm: Algorithm used for compression

        Returns:
            Decompressed size in bytes
        """
        input_path = Path(input_path)
        output_path = Path(output_path)

        if algorithm == CompressionAlgorithm.NONE:
            import shutil
            shutil.copy2(input_path, output_path)
            return output_path.stat().st_size

        compressor = self._compressors[algorithm]

        with open(input_path, 'rb') as input_file:
            with open(output_path, 'wb') as output_file:
                compressor.decompress_stream(input_file, output_file)

        self._stats["total_decompressed"] += 1
        return output_path.stat().st_size

    def _file_checksum(self, path: Path) -> str:
        """Calculate checksum of a file"""
        sha256 = hashlib.sha256()
        with open(path, 'rb') as f:
            while chunk := f.read(64 * 1024):
                sha256.update(chunk)
        return sha256.hexdigest()

    def _update_stats(
        self,
        algorithm: CompressionAlgorithm,
        original_size: int,
        compressed_size: int
    ) -> None:
        """Update compression statistics"""
        self._stats["total_compressed"] += 1
        self._stats["total_original_bytes"] += original_size
        self._stats["total_compressed_bytes"] += compressed_size

        algo_name = algorithm.value
        if algo_name not in self._stats["by_algorithm"]:
            self._stats["by_algorithm"][algo_name] = {
                "count": 0,
                "original_bytes": 0,
                "compressed_bytes": 0
            }

        self._stats["by_algorithm"][algo_name]["count"] += 1
        self._stats["by_algorithm"][algo_name]["original_bytes"] += original_size
        self._stats["by_algorithm"][algo_name]["compressed_bytes"] += compressed_size

    def get_stats(self) -> Dict[str, Any]:
        """Get compression statistics"""
        stats = self._stats.copy()

        # Calculate overall ratio
        if stats["total_original_bytes"] > 0:
            stats["overall_ratio"] = (
                stats["total_compressed_bytes"] / stats["total_original_bytes"]
            )
            stats["total_saved_bytes"] = (
                stats["total_original_bytes"] - stats["total_compressed_bytes"]
            )
            stats["total_saved_percent"] = (
                (stats["total_saved_bytes"] / stats["total_original_bytes"]) * 100
            )
        else:
            stats["overall_ratio"] = 1.0
            stats["total_saved_bytes"] = 0
            stats["total_saved_percent"] = 0.0

        return stats

    def available_algorithms(self) -> list[CompressionAlgorithm]:
        """List available compression algorithms"""
        return list(self._compressors.keys())


# Factory function
def create_compressor(
    default_algorithm: str = "zstd",
    compression_level: int = 3
) -> ArtifactCompressor:
    """Create an artifact compressor instance"""
    algo = CompressionAlgorithm(default_algorithm)
    config = CompressionConfig(
        default_algorithm=algo,
        zstd_level=compression_level,
        gzip_level=compression_level,
    )
    return ArtifactCompressor(config)


# Example usage
if __name__ == "__main__":
    compressor = create_compressor()

    print(f"Available algorithms: {[a.value for a in compressor.available_algorithms()]}")

    # Test in-memory compression
    test_data = b"Hello, World! " * 1000  # ~14KB of repetitive data
    compressed, result = compressor.compress(test_data, content_type="text/plain")

    print(f"\nIn-memory compression:")
    print(f"  Original size: {result.original_size:,} bytes")
    print(f"  Compressed size: {result.compressed_size:,} bytes")
    print(f"  Ratio: {result.compression_ratio:.2%}")
    print(f"  Space saved: {result.space_saved_percent:.1f}%")
    print(f"  Algorithm: {result.algorithm.value}")

    # Verify decompression
    decompressed = compressor.decompress(compressed, result.algorithm)
    assert decompressed == test_data, "Decompression failed!"
    print("  Decompression verified!")

    # Print stats
    stats = compressor.get_stats()
    print(f"\nOverall stats:")
    print(f"  Total compressed: {stats['total_compressed']}")
    print(f"  Overall ratio: {stats.get('overall_ratio', 1):.2%}")
    print(f"  Total saved: {stats.get('total_saved_bytes', 0):,} bytes")
