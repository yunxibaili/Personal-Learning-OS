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
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from .db import APP_ROOT, FTS_REBUILD_VERSIONS, init_db
from .core.reindex import reindex_vault
from .routers.attachments import router as attachments_router
from .routers.conversations import router as conversations_router
from .routers.export import router as export_router
from .routers.concepts import router as concepts_router
from .routers.graph import router as graph_router
from .routers.home import router as home_router
from .routers.links import router as links_router
from .routers.mastery import router as mastery_router
from .routers.notes import router as notes_router
from .routers.notes import admin_router as admin_router
from .routers.search import router as search_router
from .routers.settings import router as settings_router
from .routers.study import router as study_router
from .routers.suggest import router as suggest_router
from .routers.sync import router as sync_router
from .routers.trace import router as trace_router
from .routers.tutor import router as tutor_router
from .routers.universe import router as universe_router
from .routers.mindmap import router as mindmap_router
from .routers.memories import router as memories_router
from .routers.mistakes import router as mistakes_router

APP_VERSION = "0.1.0-dev"
WEB_DIST = APP_ROOT / "web" / "dist"


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """启动即建目录并跑 migration（幂等）；数据库就绪先于任何请求。

    FTS 重建类 migration（ADR-027 的 010_fts_bigram）应用后自动触发一次
    全量 reindex——notes_fts 是派生索引，DROP+CREATE 后必须从 vault 重建
    才可检索。重建失败不阻断启动（搜索降级为空结果，后续 sync/reindex 可自愈）。
    """
    import logging

    from .db import connect, workspace_root

    logger = logging.getLogger(__name__)
    newly = init_db()
    if set(newly) & FTS_REBUILD_VERSIONS:
        logger.info("FTS rebuild migration applied (%s) → full reindex", newly)
        conn = connect()
        try:
            reindex_vault(conn, workspace_root() / "vault")
            conn.commit()
        except Exception:
            conn.rollback()
            logger.exception("FTS rebuild reindex failed; search degraded "
                             "until next reindex")
        finally:
            conn.close()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Personal Learning OS", version=APP_VERSION,
                  lifespan=lifespan)
    # P0-2b（方案 i）：桌面 WebView origin 为 http://tauri.localhost，
    # 生产前端以绝对地址 VITE_API_BASE 跨源访问本机 sidecar——需放行 CORS。
    # dev 5173 一并放行（vite proxy 同源转发不受影响，显式列出便于直连调试）。
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://tauri.localhost", "https://tauri.localhost",
            "http://localhost:5173",
        ],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(settings_router)
    app.include_router(notes_router)
    app.include_router(links_router)
    app.include_router(attachments_router)
    app.include_router(search_router)
    app.include_router(suggest_router)
    app.include_router(mastery_router)
    app.include_router(graph_router)
    app.include_router(home_router)
    app.include_router(tutor_router)
    app.include_router(universe_router)
    app.include_router(mindmap_router)
    app.include_router(concepts_router)
    app.include_router(sync_router)
    app.include_router(export_router)
    app.include_router(conversations_router)
    app.include_router(memories_router)
    app.include_router(mistakes_router)
    app.include_router(study_router)
    app.include_router(trace_router)
    app.include_router(admin_router)

    @app.exception_handler(RequestValidationError)
    def on_validation_error(_req, exc: RequestValidationError) -> JSONResponse:
        # include_input=False（2026-08-29 修）：pydantic 默认把触发校验失败的
        # **原始输入值**放进 errors() 的 input 字段。任何端点、任何字段——
        # 只要值类型/长度不合规，该值就会被原样回显进 400 响应体，
        # 构成唯一未被过滤、也未被守护测试覆盖的敏感值泄漏面
        # （实测：note_ids=["sk-xxx"] → 响应体回显 sk-xxx）。
        # FastAPI 0.141 的 errors() 不支持 include_input 参数——手工剥离：
        # input（原始输入值）与 url 均可能携带用户敏感数据，不进响应体
        errs = [
            {k: v for k, v in e.items() if k not in ("input", "url")}
            for e in exc.errors()[:3]
        ]
        return JSONResponse(status_code=400, content={
            "error": {"code": "invalid_body", "message": str(errs)}
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
