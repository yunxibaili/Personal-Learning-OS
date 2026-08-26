"""M1 附件上传/读取测试。"""
from __future__ import annotations

import re

from fastapi.testclient import TestClient

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32   # 合法魔数前缀即可


def test_upload_png_and_fetch_back(client: TestClient) -> None:
    r = client.post("/api/v1/attachments",
                    files={"file": ("pic.png", PNG_BYTES, "image/png")})
    assert r.status_code == 200
    data = r.json()
    assert set(data.keys()) == {"url", "name"}
    assert re.match(r"^/api/v1/attachments/[0-9a-f]{12}\.png$", data["url"])

    got = client.get(data["url"])
    assert got.status_code == 200
    assert got.content == PNG_BYTES


def test_upload_pdf_allowed(client: TestClient) -> None:
    r = client.post("/api/v1/attachments",
                    files={"file": ("doc.pdf", b"%PDF-1.4 fake", "application/pdf")})
    assert r.status_code == 200
    assert r.json()["name"].endswith(".pdf")


def test_upload_rejects_disallowed_type(client: TestClient) -> None:
    r = client.post("/api/v1/attachments",
                    files={"file": ("evil.exe", b"MZ...", "application/x-msdownload")})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "bad_type"


def test_attachment_name_validation(client: TestClient) -> None:
    r = client.get("/api/v1/attachments/..%2Fsecret.pdf")
    assert r.status_code in (400, 404)
