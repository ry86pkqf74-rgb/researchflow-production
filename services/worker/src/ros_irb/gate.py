from __future__ import annotations

from typing import Optional

from ros_irb.storage import is_irb_submitted


class IRBGateError(RuntimeError):
    """Exception raised when IRB submission gate is not satisfied."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)

    def __str__(self) -> str:
        return self.message


def require_irb_submission(*, flag_path: Optional[str] = None) -> None:
    """
    Enforce that IRB submission has been completed before allowing PHI-sensitive steps.

    This gate is intended to be called by:
      - online-mode unlock checks
      - data acquisition / ingestion entrypoints
      - any pipeline step that requires IRB approval
    """
    ok = is_irb_submitted(None if flag_path is None else __import__("pathlib").Path(flag_path))
    if not ok:
        raise IRBGateError(
            "IRB submission is required before proceeding. "
            "Complete the IRB Submission workflow step to generate and store an IRB draft, "
            "then mark IRB as submitted."
        )
