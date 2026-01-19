"""
Environment Variable Validator for Worker Service

Validates all required environment variables at startup using Pydantic.
Exits the process immediately if validation fails to prevent running
with invalid configuration.

Phase A - Task 15: Env Var Validation at Startup
"""

import sys
import os
from typing import Optional
from pydantic import BaseSettings, Field, validator, AnyHttpUrl


class WorkerEnv(BaseSettings):
    """Worker service environment configuration with validation"""

    # Service Configuration
    PORT: int = Field(default=8000, ge=1, le=65535)
    HOST: str = Field(default="0.0.0.0")
    WORKER_NAME: str = Field(default="worker-1")

    # Redis Configuration (required)
    REDIS_URL: str = Field(..., env='REDIS_URL')
    REDIS_DB: int = Field(default=0, ge=0, le=15)

    # Worker Pool Configuration
    WORKER_CONCURRENCY: int = Field(default=5, ge=1, le=100)
    MAX_RETRIES: int = Field(default=3, ge=0, le=10)
    RETRY_DELAY: int = Field(default=60, ge=0)  # seconds

    # Service URLs
    ORCHESTRATOR_URL: Optional[AnyHttpUrl] = None
    PHI_ENGINE_URL: Optional[AnyHttpUrl] = None
    TIKA_URL: Optional[AnyHttpUrl] = Field(default="http://tika:9998")
    WEAVIATE_URL: Optional[AnyHttpUrl] = Field(default="http://weaviate:8080")
    MODEL_SERVER_URL: Optional[AnyHttpUrl] = Field(default="http://model-server:8000")

    # Logging Configuration
    LOG_LEVEL: str = Field(default='INFO')
    LOG_FORMAT: str = Field(default='json')

    # Data Directories
    DATA_DIR: str = Field(default='/data')
    ARTIFACTS_DIR: str = Field(default='/data/artifacts')
    LOGS_DIR: str = Field(default='/data/logs')
    MANIFESTS_DIR: str = Field(default='/data/manifests')
    TEMP_DIR: str = Field(default='/tmp/worker')

    # Pipeline Configuration
    ENABLE_OCR: bool = Field(default=False)
    ENABLE_NLP: bool = Field(default=False)
    ENABLE_VECTOR_INDEXING: bool = Field(default=False)

    # Resource Limits
    MAX_FILE_SIZE_MB: int = Field(default=100, ge=1, le=1000)
    MAX_MEMORY_MB: int = Field(default=2048, ge=512)
    PROCESSING_TIMEOUT: int = Field(default=300, ge=60)  # seconds

    # Security
    ENABLE_VIRUS_SCAN: bool = Field(default=False)
    CLAMAV_HOST: Optional[str] = Field(default="clamav")
    CLAMAV_PORT: int = Field(default=3310)

    # API Keys (optional for certain features)
    ANTHROPIC_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None

    class Config:
        env_file = '.env'
        case_sensitive = True

    @validator('REDIS_URL')
    def validate_redis_url(cls, v):
        """Ensure REDIS_URL starts with redis://"""
        if not v.startswith('redis://'):
            raise ValueError('REDIS_URL must start with redis://')
        return v

    @validator('LOG_LEVEL')
    def validate_log_level(cls, v):
        """Ensure LOG_LEVEL is valid"""
        valid_levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
        v_upper = v.upper()
        if v_upper not in valid_levels:
            raise ValueError(f'LOG_LEVEL must be one of {valid_levels}')
        return v_upper

    @validator('TEMP_DIR', 'DATA_DIR', 'ARTIFACTS_DIR', 'LOGS_DIR', 'MANIFESTS_DIR')
    def validate_directory(cls, v):
        """Ensure directory paths are absolute"""
        if not os.path.isabs(v):
            raise ValueError(f'Directory path must be absolute: {v}')
        return v


_validated_env: Optional[WorkerEnv] = None


def validate_env() -> WorkerEnv:
    """
    Validates environment variables and exits process on failure.
    Should be called at application startup before any other initialization.

    Returns:
        WorkerEnv: Validated environment configuration

    Raises:
        SystemExit: If validation fails (exits with code 1)
    """
    global _validated_env

    if _validated_env:
        return _validated_env

    try:
        _validated_env = WorkerEnv()

        # Create directories if they don't exist
        for dir_path in [
            _validated_env.TEMP_DIR,
            _validated_env.ARTIFACTS_DIR,
            _validated_env.LOGS_DIR,
            _validated_env.MANIFESTS_DIR
        ]:
            os.makedirs(dir_path, exist_ok=True)

        print("✅ Environment validation successful", file=sys.stderr)
        print(f"   WORKER_NAME: {_validated_env.WORKER_NAME}", file=sys.stderr)
        print(f"   PORT: {_validated_env.PORT}", file=sys.stderr)
        print(f"   LOG_LEVEL: {_validated_env.LOG_LEVEL}", file=sys.stderr)
        print(f"   WORKER_CONCURRENCY: {_validated_env.WORKER_CONCURRENCY}", file=sys.stderr)

        return _validated_env

    except Exception as e:
        print("❌ Environment validation failed:", file=sys.stderr)
        print("", file=sys.stderr)
        print(f"  {str(e)}", file=sys.stderr)
        print("", file=sys.stderr)
        print("Please check your .env file and ensure all required variables are set.", file=sys.stderr)
        print("See .env.example for reference.", file=sys.stderr)
        sys.exit(1)


def get_env() -> WorkerEnv:
    """
    Get the validated environment configuration.

    Returns:
        WorkerEnv: Validated environment configuration

    Raises:
        RuntimeError: If validate_env() hasn't been called yet
    """
    if _validated_env is None:
        raise RuntimeError("Environment not validated. Call validate_env() first.")
    return _validated_env
