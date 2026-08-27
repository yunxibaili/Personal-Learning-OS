"""附件上传/读取：图片与 PDF，sha 前缀命名防碰撞。仅 Data/Core 层触达文件。"""
from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from ..core.knowledge import attachments_dir, is_safe_attachment_name

router = APIRouter(prefix="/api/v1/attachments", tags=["attachments"])

ALLOWED_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".pdf"}
MAX_BYTES = 20 * 1024 * 1024


def _err(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status,
                        content={"error": {"code": code, "message": message}})


@router.post("")
async def upload_attachment(file: UploadFile = File(...)) -> dict:
    ext = Path(file.filename or "").suffix.lower()
    ctype = file.content_type or ""
    if ext not in ALLOWED_EXTS or not (
        ctype.startswith("image/") or ctype == "application/pdf"
    ):
        return _err(400, "bad_type",
                    f"不支持的附件类型: {file.filename} ({ctype})")

    data = await file.read()
    if len(data) > MAX_BYTES:
        return _err(400, "too_large", "附件超过 20MB 上限")

    name = uuid.uuid4().hex[:12] + ext
    target = attachments_dir() / name
    target.write_bytes(data)
    return {"url": f"/api/v1/attachments/{name}", "name": name}


@router.get("/{name}")
def get_attachment(name: str):
    if not is_safe_attachment_name(name):
        return _err(400, "bad_name", "非法附件名")
    p = attachments_dir() / name
    if not p.is_file():
        return _err(404, "http_404", "附件不存在")
    media_map = {".pdf": "application/pdf"}
    media = media_map.get(p.suffix, None)
    # 图片类型交给 FileResponse 按 ext 猜测即可；PDF 显式指定
    return FileResponse(p, media_type=media) if media else FileResponse(p)
