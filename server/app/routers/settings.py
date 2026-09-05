"""settings KV API：GET /api/v1/settings · PUT /api/v1/settings。

敏感键读取时脱敏为 "******"；错误统一 {error:{code,message}}。

敏感判定**复用** core/ai/constants.is_sensitive_setting（三规则并集），
与 core/export 同源——2026-08-29 修：此前本模块只用「键名含 api_key 子串」
单一规则，导致 llm.password / llm.token / 值为 sk- 的任意键明文返回，
而同一次导出会把它们过滤掉（两条防线规则不一致）。
"""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from ..core.ai.constants import is_sensitive_setting
from ..db import get_all_settings, put_settings

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])

MASKED = "******"


def _mask(key: str, value: str) -> str:
    if value and is_sensitive_setting(key, value):
        return MASKED
    return value


class SettingsBody(BaseModel):
    settings: dict[str, str]


# Response models（Contract Hardening Phase A：Tutor v0.3 前置契约；
# GET 的敏感键脱敏（******）在 router 层完成，model 只描述载体形状）


class SettingsResponse(BaseModel):
    settings: dict[str, str]


class OkResponse(BaseModel):
    ok: bool


@router.get("")
def get_settings() -> SettingsResponse:
    raw = get_all_settings()
    return {"settings": {k: _mask(k, v) for k, v in raw.items()}}


@router.put("")
def put_settings_endpoint(body: SettingsBody) -> OkResponse:
    try:
        put_settings(body.settings)
    except Exception as exc:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "db_error", "message": str(exc)}},
        )
    return {"ok": True}
