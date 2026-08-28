"""Personal Learning OS — FastAPI 入口（Backend 层）。

- 仅绑定 127.0.0.1（docs/security/network-boundary.md）
- 端口：环境变量 PORT 可覆盖默认 8000（与 UpMark 共存时 PORT=8100）
- API 版本化前缀 /api/v1；错误统一 {error:{code,message}}
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from .db import APP_ROOT, init_db
from .routers.attachments import router as attachments_router
from .routers.export import router as export_router
from .routers.concepts import router as concepts_router
from .routers.graph import router as graph_router
from .routers.links import router as links_router
from .routers.mastery import router as mastery_router
from .routers.notes import router as notes_router
from .routers.notes import admin_router as admin_router
from .routers.search import router as search_router
from .routers.settings import router as settings_router
from .routers.suggest import router as suggest_router
from .routers.sync import router as sync_router
from .routers.tutor import router as tutor_router
from .routers.universe import router as universe_router
from .routers.mindmap import router as mindmap_router

APP_VERSION = "0.1.0-dev"
WEB_DIST = APP_ROOT / "web" / "dist"


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """启动即建目录并跑 migration（幂等）；数据库就绪先于任何请求。"""
    init_db()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Personal Learning OS", version=APP_VERSION,
                  lifespan=lifespan)
    app.include_router(settings_router)
    app.include_router(notes_router)
    app.include_router(links_router)
    app.include_router(attachments_router)
    app.include_router(search_router)
    app.include_router(suggest_router)
    app.include_router(mastery_router)
    app.include_router(graph_router)
    app.include_router(tutor_router)
    app.include_router(universe_router)
    app.include_router(mindmap_router)
    app.include_router(concepts_router)
    app.include_router(sync_router)
    app.include_router(export_router)
    app.include_router(admin_router)

    @app.exception_handler(RequestValidationError)
    def on_validation_error(_req, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(status_code=400, content={
            "error": {"code": "invalid_body", "message": str(exc.errors()[:3])}
        })

    @app.exception_handler(StarletteHTTPException)
    def on_http_exception(_req, exc: StarletteHTTPException) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={
            "error": {"code": f"http_{exc.status_code}",
                      "message": str(exc.detail)}
        })

    @app.get("/api/v1/health")
    def health() -> dict:
        db_ok = True
        try:
            from .db import connect

            connect().execute("SELECT 1").close()
        except Exception as exc:  # noqa: BLE001 — health 必须如实报告，带上下文上抛给日志
            db_ok = False
            app.state.last_db_error = repr(exc)
        return {"status": "ok" if db_ok else "degraded",
                "db": db_ok, "version": APP_VERSION}

    # 生产形态（M6 起）：前端构建产物存在则由后端托管，浏览器单端口访问
    if WEB_DIST.is_dir():
        app.mount("/", StaticFiles(directory=str(WEB_DIST), html=True), name="web")

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",  # 永不 0.0.0.0 —— network-boundary 红线
        port=int(os.environ.get("PORT", "8000")),
    )
