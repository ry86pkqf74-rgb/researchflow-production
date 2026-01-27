"""Entry point for running the Guideline Engine."""
import uvicorn


def main():
    """Run the FastAPI application."""
    uvicorn.run(
        "guideline_engine.api.app:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info",
    )


if __name__ == "__main__":
    main()
