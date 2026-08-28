"""Export API（T-EXPORT，B11）：一键全量导出——用户数据永不锁死红线的兑现。

GET /api/v1/export → application/zip（vault + attachments + eventlogs +
mind_maps + settings 脱敏）。范围契约见 docs/release/EXPORT_MANIFEST.md。
"""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import Response

from ..core.export import create_export_zip

router = APIRouter(prefix="/api/v1/export", tags=["export"])


@router.get("")
def get_export() -> Response:
    """下载全量导出包（zip）。只读幂等操作，无任何副作用。"""
    data = create_export_zip()
    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="learning-os-export.zip"'},
    )
