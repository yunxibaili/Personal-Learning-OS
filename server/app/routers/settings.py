"""settings KV API：GET /api/v1/settings · PUT /api/v1/settings。

api_key 类键读取时脱敏为 "******"；错误统一 {error:{code,message}}。
"""
from __future__ import annotations

import sqlite3

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..db import connect

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])

MASK_SUFFIX = "api_key"
MASKED = "******"


def _mask(key: str, value: str) -> str:
    if MASK_SUFFIX in key and value:
        return MASKED
    return value


class SettingsBody(BaseModel):
    settings: dict[str, str]


@router.get("")
def get_settings() -> dict:
    conn = connect()
    try:
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
        return {"settings": {r["key"]: _mask(r["key"], r["value"]) for r in rows}}
    finally:
        conn.close()


@router.put("")
def put_settings(body: SettingsBody) -> dict:
    conn = connect()
    try:
        conn.executemany(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            list(body.settings.items()),
        )
        conn.commit()
    except sqlite3.Error as exc:  # 带上下文显式上报，不静默吞错
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "db_error", "message": str(exc)}},
        )
    finally:
        conn.close()
    return {"ok": True}
