# Active Task

> AI 工作记忆：当前正在做什么。
> 上次更新：2026-08-27 · M7-005 Conflict UI 八项清单已提交，等待用户确认后开工

---

## Task ID

**M7-005 Conflict UI**（低打扰同步反馈入口）

## Status

DRAFT — AGENTS §12 八项清单待用户确认，未写任何代码

## 八项清单（AGENTS §12）

1. **功能目标**：给用户一个「知道发生了什么、但不被打扰」的冲突解决入口；
   不是网盘式警告中心（ADR-022：Sync = 基础设施）
2. **架构位置**：Backend 新增 routers/sync.py（只读）+ core/sync/conflicts.py
   （纯查询函数）· Frontend 在 Dashboard 内嵌 SyncStatusPanel 区块
3. **Frontend 改动**：web/src/components/sync/SyncStatusPanel.tsx（新建）+
   DashboardView 挂载点；无新 tab、无新页面、无弹窗（ADR-013/022）
4. **Backend 改动**：routers/sync.py 只读两个端点；无写入端点；
   绑定 127.0.0.1 既有全局边界不变
5. **Core 改动**：core/sync/conflicts.py 纯函数——扫描 workspace 派生冲突状态：
   - 冲突源 A（已存在）：mind_maps/*.local.json 备份（M7-004 Apply 落地的产物），
     主文件=远端胜者，备份=本地版
   - ⚠️ 冲突源 B（**范围决策点，需确认**）：vault/*.md 双份保留机制目前不存在
     （Apply 对 vault 是 LWW 直接替换）。方案：
     a. M7-005 只做 A（mindmap），vault 双份留给独立任务（推荐——不改 Apply 层，
        符合 Forbidden 不改同步逻辑的既有纪律）
     b. 本任务顺带给 apply.py 加 vault conflict copy（扩大范围，碰 M7-004 已冻结代码）
6. **Data 改动**：零新表零迁移。冲突列表实时从文件系统派生（.local.json 存在即冲突），
   不引入 sync-state 持久化快照（避免第二真相源）
7. **API 设计**（只读 /api/v1）：
   - GET /sync/status → { conflicts: [{path, kind, local_path, remote_path,
     local_updated_at, remote_updated_at}], checked_at }
   - POST /sync/conflicts/{path}/resolve {resolution: keep_local|keep_remote}
     （唯一写动作：复制选择侧内容到主路径，删除另一侧备份；经 apply 白名单校验；
     响应 {ok, resolved_path}）；错误契约沿用 {error:{code,message}}
8. **文件变化列表**：
   - 新建 server/app/core/sync/conflicts.py
   - 新建 server/app/routers/sync.py（main.py 注册）
   - 新建 server/tests/api/test_sync_conflicts.py + 单测
   - 新建 web/src/components/sync/SyncStatusPanel.tsx
   - 改 DashboardView.tsx（挂载）/ shared/types/sync.ts（契约）/ global.css（少量）
   - 文档：TECH_DESIGN §9 API 表补两行 · CURRENT_STATE · CHANGELOG · TASKS

## 设计三问

1. 用户真正需要吗？——是。冲突不解决会静默积累，但也不该弹窗打断学习
2. 现在必须做吗？——是。M7-004 已会产生 .local.json 备份，无 UI 则永远无人处理
3. 三个月后新人能看懂吗？——目标形态是一个只读面板+两个按钮，不新增状态管理库

## Forbidden（用户已定）

❌ 自动解决所有冲突 ❌ 修改 mastery ❌ 修改 learning_events
❌ 修改 vault 内容结构 ❌ 引入通知系统 ❌ 强制弹窗/红色警告中心

## Acceptance

pytest ≥385（自然增长）· build/vitest pass · 空冲突时面板显示"暂无同步冲突"
且零请求开销路径可跳过 · 契约测试锁定 shared/types/sync.ts
