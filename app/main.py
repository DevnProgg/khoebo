from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import os
from pathlib import Path
import stat

import anyio
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException
from starlette.responses import Response
from starlette.types import Scope

import app.models  # noqa: F401  (register SQLAlchemy models)
from app.api.router import api_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings.validate_for_runtime()
    if settings.auto_create_tables:
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):  # type: ignore[no-untyped-def]
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api_router, prefix="/api/v1")


class SPAStaticFiles(StaticFiles):
    """Static file server with clean URL support (.html) and SPA fallback."""

    async def get_response(self, path: str, scope: Scope) -> Response:
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code == 404 and self.html:
                # 1. Clean URL support: e.g. /login -> /login.html
                html_path = path.rstrip("/") + ".html"
                full_path, stat_result = await anyio.to_thread.run_sync(
                    self.lookup_path, html_path
                )
                if stat_result and stat.S_ISREG(stat_result.st_mode):
                    return self.file_response(full_path, stat_result, scope)

                # 2. SPA fallback for extensionless non-API/non-system routes
                normalized_path = path.strip("/")
                system_prefixes = ("api", "docs", "redoc", "openapi.json")
                if (
                    not any(
                        normalized_path.startswith(prefix) for prefix in system_prefixes
                    )
                    and "." not in Path(normalized_path).name
                ):
                    index_path, stat_result = await anyio.to_thread.run_sync(
                        self.lookup_path, "index.html"
                    )
                    if stat_result and stat.S_ISREG(stat_result.st_mode):
                        return self.file_response(index_path, stat_result, scope)
            raise exc


dist_dir = Path(
    os.getenv("STATIC_DIR", Path(__file__).resolve().parent.parent / "mobile" / "dist")
)
if dist_dir.is_dir():
    app.mount("/", SPAStaticFiles(directory=str(dist_dir), html=True), name="static")

