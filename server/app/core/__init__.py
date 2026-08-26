"""Core Engine 分层边界占位。

本包只放可复用、不依赖 FastAPI 的核心算法
（掌握度/SM-2 → M3，图查询 → M2，上下文管线 → M4，同步 diff → M7）。
Backend(routers) 调用 Core；Core 不 import FastAPI —— 见 docs/architecture/separation.md。
"""
