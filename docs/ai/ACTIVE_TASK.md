# Active Task

> AI 工作记忆：当前正在做什么。
> 上次更新：2026-08-27 · M7-Preview-001 就位 → **下一步是用户本人启动 PC 实测**

---

## Task ID

M7-Preview-001 Local Demo Preparation（脚本侧 ✅，体验侧待用户执行）

## 启动方式

```
终端1: cd server && .venv\Scripts\python -m uvicorn app.main:app --reload   # :8000
终端2: cd web && npm run dev                                                # :5173
浏览器打开 http://localhost:5173
```

## 用户体验清单（重点看产品感，不看代码）

1. Dashboard——是否像"学习 OS 首页"而非管理后台；SyncStatusPanel 应显示无冲突
2. Knowledge——笔记编辑/双链/搜索；图谱里 ML 概念簇的形态
3. Universe（重点）——mastery 颜色分布（注意力机制=微光、损失函数=暗、学习率=熄灭）
4. MindMap——亲手新建一张图、拖节点、bind 到 [[注意力机制]]（刻意未预置）
5. Tutor 三入口——笔记 Explain / Review 错答 Hint / Universe 弱项进入

## 待用户裁定

- workspace/db 残留 TestConcept/MasteryTest 测试脏数据是否清除
- /concepts CRUD 缺口放入 M7-008 还是 P8
- 体验后决定：先 M7-007 还是直接 P8 产品化

