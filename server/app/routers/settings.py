"""settings KV API：GET /api/v1/settings · PUT /api/v1/settings。

api_key 类键读取时脱敏为 "******"；错误统一 {error:{code,message}}。
"""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from ..db import get_all_settings, put_settings

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
    raw = get_all_settings()
    return {"settings": {k: _mask(k, v) for k, v in raw.items()}}


@router.put("")
def put_settings_endpoint(body: SettingsBody) -> dict:
    try:
        put_settings(body.settings)
    except Exception as exc:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "db_error", "message": str(exc)}},
        )
    return {"ok": True}
