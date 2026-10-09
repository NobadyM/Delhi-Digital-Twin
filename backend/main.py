import logging
import time
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import engine, Base
from app.ml.manager import model_manager
from app.services.worker import ingestion_worker
from app.routers import legacy, observations, forecasts, anomalies, health

# Configure structured logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger("delhi_twin.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifecycle management:
    - Creates database tables on startup.
    - Loads AI/ML artifacts into ModelManager singleton.
    - Launches controlled background ingestion worker.
    - Gracefully stops background tasks on shutdown.
    """
    logger.info("Initializing Delhi Digital Twin backend services...")
    # 1. Initialize persistent storage schema
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified/created successfully.")

    # 2. Warm up ML model
    model_manager.load_model()
    if model_manager.is_loaded():
        logger.info(f"Model loaded successfully (version: {model_manager.version})")
    else:
        logger.warning("ML model could not be loaded; heuristic fallback active.")

    # 3. Start background ingestion worker
    await ingestion_worker.start()

    yield

    # Clean shutdown
    logger.info("Shutting down background ingestion worker...")
    await ingestion_worker.stop()
    logger.info("Delhi Digital Twin backend stopped.")


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Enterprise Digital Twin Backend for Delhi Urban Air Quality Monitoring. "
        "Provides deterministic real-time telemetry, multi-horizon forecasts, "
        "and deduplicated AI anomaly detection."
    ),
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Structured Request Logging & Request-ID Tracking Middleware
@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    start_time = time.time()

    # Pass request ID in state
    request.state.request_id = request_id

    try:
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time-Ms"] = f"{process_time:.2f}"

        logger.info(
            f"[{request_id[:8]}] {request.method} {request.url.path} "
            f"status={response.status_code} duration={process_time:.1f}ms"
        )
        return response
    except Exception as exc:
        process_time = (time.time() - start_time) * 1000
        logger.error(
            f"[{request_id[:8]}] Unhandled error for {request.method} {request.url.path}: {exc}",
            exc_info=True,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": "error",
                "message": "Internal server error occurred. Please try again later.",
                "request_id": request_id,
            },
            headers={"X-Request-ID": request_id},
        )


# Include Routers
app.include_router(legacy.router)
app.include_router(observations.router)
app.include_router(forecasts.router)
app.include_router(anomalies.router)
app.include_router(health.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)