import asyncio
import logging
from app.config import settings
from app.database import SessionLocal
from app.services.ingestion import run_ingestion_pipeline

logger = logging.getLogger("delhi_twin.services.worker")

class BackgroundIngestionWorker:
    def __init__(self):
        self._running = False
        self._task: asyncio.Task | None = None
        self._lock = asyncio.Lock()
        self.last_run_time = None
        self.last_status = "IDLE"

    async def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info(f"Background ingestion worker started (interval: {settings.INGESTION_INTERVAL_SECONDS}s)")

    async def stop(self):
        if not self._running:
            return
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Background ingestion worker stopped gracefully.")

    async def trigger_once(self) -> dict:
        """
        Manually triggers an ingestion run with concurrency lock.
        """
        async with self._lock:
            loop = asyncio.get_running_loop()
            return await loop.run_in_executor(None, self._execute_sync)

    def _execute_sync(self) -> dict:
        db = SessionLocal()
        try:
            res = run_ingestion_pipeline(db)
            self.last_status = res.get("status", "UNKNOWN")
            return res
        finally:
            db.close()

    async def _run_loop(self):
        # Run immediately on startup to ensure fresh data
        try:
            await self.trigger_once()
        except Exception as exc:
            logger.error(f"Initial ingestion failed: {exc}")

        while self._running:
            try:
                await asyncio.sleep(settings.INGESTION_INTERVAL_SECONDS)
                if not self._running:
                    break
                await self.trigger_once()
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error(f"Error in background ingestion loop: {exc}")
                await asyncio.sleep(10)  # Brief pause before retrying loop


ingestion_worker = BackgroundIngestionWorker()
