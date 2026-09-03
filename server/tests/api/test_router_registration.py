"""路由注册守护：routers/ 下定义的每个 APIRouter 都必须挂到 app 上。

起因（B28，2026-08-29）：`routers/memories.py` 连同 core 管理面（28 个单测全绿）
与 16 个 HTTP 测试都已写完，唯独 main.py 里 `from .routers.memories import ...`
之后漏了 `include_router(...)`。结果是端点整体不存在（404/405），
但没有任何一处测试能说出「代码没错，是没接线」。

这类失效的共同特征是"接线缺失"——以 include_router 为例，对象/接口写好了、
接线是另一个动作，而接线本身没有被任何断言覆盖。历史上有过"功能写好但未接线"
的死状态先例（前端期 issue），此次回归到后端路由同样成立。

本文件把「写了 router 就必须挂上」变成可执行约束：
新增 router 文件而忘记 include_router → 这里立即失败，且失败信息直指缺失路径。

覆盖范围（两个方向都要，缺一不可）：
  - 正向：routers/ 包下每个模块内的每个 APIRouter，其全部路由都出现在 app 上
  - 特例记忆：/api/v1/memories —— B28 的直接回归保护，防止整模块再次脱挂

注意：这里用 pkgutil 扫描包目录而非依赖 main.py 的 import 列表——
若某人新增了 router 文件却连 import 都没写，扫描依然能发现。
"""
from __future__ import annotations

import importlib
import pkgutil

from fastapi import APIRouter
from fastapi.routing import APIRoute

import app.routers as routers_pkg
from app.main import create_app


def _full_path(router: APIRouter, route: APIRoute) -> str:
    """路由挂载后的完整路径。

    ⚠️ 实测（FastAPI 0.141.1）：`router.routes[i].path` **已经包含** prefix。
    旧版行为是不含、要等 include_router 时才拼——本函数对两种行为都成立，
    因此不依赖任何一版的具体实现。
    """
    path = route.path
    if router.prefix and not path.startswith(router.prefix):
        return f"{router.prefix}{path}"
    return path or "/"


def _mounted_paths(app) -> set[str]:
    """app 上实际可路由的 path 集合（含各 router 的 prefix）。

    ⚠️ 实测（FastAPI 0.141.1）：`app.include_router(r)` **不再**把子路由展开成
    一串 APIRoute 塞进 `app.routes`，而是放一个惰性的 `_IncludedRouter` 壳
    （app.routes 实测 23 项 = 17 壳 + 1 APIRoute(health) + 4 Route + 1 Mount），
    真正的路由挂在壳的 `original_router.routes` 上，请求时再展开。

    只过滤 `isinstance(r, APIRoute)` 会漏掉全部 17 个壳，本文件三条断言
    随即全部假红——而 HTTP 测试（走 client fixture）却是绿的，因为请求
    匹配时壳会被正常展开。这类「代码没错、扫描方式过时」的假红比没有守护
    更糟：它会让人以为接线断了，而实际问题在守护自己。

    两版兼容做法：APIRoute 直接取；有 `original_router` 的壳则展开其内层。
    用 hasattr 鸭子类型而非 isinstance 私有类——`_IncludedRouter` 带下划线
    前缀，属内部实现，类型名在下一版可能变化。
    """
    paths: set[str] = set()
    for r in app.routes:
        if isinstance(r, APIRoute):
            paths.add(r.path)
        elif hasattr(r, "original_router"):
            inner = r.original_router
            for sub in inner.routes:
                if isinstance(sub, APIRoute):
                    paths.add(_full_path(inner, sub))
    return paths


def _declared_routers() -> list[tuple[str, str, APIRouter]]:
    """扫描 routers/ 包，收集 (模块名, 变量名, router)。

    用 vars(mod) 而非只取 `router`：notes.py 额外导出 admin_router，
    只认 `router` 会漏掉它。
    """
    found: list[tuple[str, str, APIRouter]] = []
    for mod_info in pkgutil.iter_modules(routers_pkg.__path__):
        if mod_info.name == "__init__":
            continue
        mod = importlib.import_module(f"{routers_pkg.__name__}.{mod_info.name}")
        for name, obj in vars(mod).items():
            if isinstance(obj, APIRouter):
                found.append((mod.__name__, name, obj))
    return found


class TestRouterRegistration:
    def test_every_declared_route_is_mounted(self):
        """正向：routers/ 里声明的每条路由都必须能在 app 上找到。"""
        mounted = _mounted_paths(create_app())
        missing = [
            f"{mod}.{name}: {_full_path(router, route)}"
            for mod, name, router in _declared_routers()
            for route in router.routes
            if _full_path(router, route) not in mounted
        ]
        assert not missing, (
            "以下路由已定义但未挂到 app（main.py 缺 include_router？）：\n  "
            + "\n  ".join(missing)
        )

    def test_no_orphan_router_module(self):
        """每个 router 模块至少贡献一条路由——防止整模块脱挂后静默。"""
        mounted = _mounted_paths(create_app())
        orphan = [
            f"{mod}.{name} (prefix={router.prefix!r})"
            for mod, name, router in _declared_routers()
            if not any(_full_path(router, r) in mounted for r in router.routes)
        ]
        assert not orphan, f"整个 router 未挂载：{orphan}"

    def test_memories_routes_mounted(self):
        """B28 直接回归保护：/api/v1/memories 四个端点必须可达。

        与上面的通用守护有意重叠——通用守护报错时指向的是「某条路径缺失」，
        这里指向的是「记忆管理面又脱挂了」，后者对读测试失败的人更有信息量。
        """
        mounted = _mounted_paths(create_app())
        expected = ["/api/v1/memories", "/api/v1/memories/{memory_id}"]
        for path in expected:
            assert path in mounted, f"记忆管理面未挂载：{path}"

    def test_guard_itself_is_not_vacuous(self):
        """守护自检：两侧扫描器都必须真的发现了路由，否则前三条断言全是空转。

        若有人改了 routers/ 包结构（比如改成命名空间包），或 app 侧扫描方式
        过时（FastAPI 改 include_router 实现），扫描结果会偏小，上面所有断言
        都会因为「没有缺失」而通过——守护静默失效比没有更危险。
        """
        declared = _declared_routers()
        assert len(declared) >= 10, (
            f"只扫描到 {len(declared)} 个 router，远少于预期——"
            "扫描逻辑可能已失效，本文件的其它断言不再可信"
        )
        total_routes = sum(len(r.routes) for _, _, r in declared)
        assert total_routes >= 40, (
            f"只扫描到 {total_routes} 条路由，扫描逻辑可能已失效"
        )

        # app 侧同样要自检：2026-08-29 实测故障就是这一侧塌的——
        # app.routes 里只剩 health 一条，mounted 集合规模 1，而没有任何断言察觉。
        mounted = _mounted_paths(create_app())
        assert len(mounted) >= 40, (
            f"app 上只扫描到 {len(mounted)} 条路径，远少于声明的 {total_routes} 条——"
            "_mounted_paths 可能已无法穿透 include_router 的挂载形态"
            "（FastAPI 升级改变了 app.routes 的结构？）"
        )

    def test_mounted_paths_penetrates_included_routers(self):
        """app 侧扫描必须能看见 include_router 挂进来的路由，而不只是 @app.get。

        B28 交付时的实测故障：`_mounted_paths` 只认 APIRoute，而 FastAPI 0.141
        把 include_router 的路由包在惰性壳里，结果 mounted 只剩 health，
        三条守护断言全红、HTTP 测试却全绿。本用例锁定「扫描能穿透壳」这一
        能力本身，下次 FastAPI 再改结构会在这里先炸，而不是在业务断言上炸。
        """
        mounted = _mounted_paths(create_app())
        # /api/v1/memories 只可能来自 include_router（main.py 无同名 @app.get）
        assert "/api/v1/memories" in mounted
        # 来自 @app.get 的直接注册同样要能被扫到（两种形态都得覆盖）
        assert "/api/v1/health" in mounted
