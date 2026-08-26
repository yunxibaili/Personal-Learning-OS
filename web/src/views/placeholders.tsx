import type { ReactNode } from "react";

/** 占位视图：各里程碑在此文件上原地实现，不新建路由体系。 */
export function Placeholder(props: { title: string; desc: string; milestone: string }) {
  return (
    <section className="placeholder">
      <h2>{props.title}</h2>
      <p>{props.desc}</p>
      <span className="milestone">{props.milestone} 交付</span>
    </section>
  );
}

export function NoteEditorView(): ReactNode {
  return (
    <Placeholder
      title="笔记"
      desc="TipTap 编辑器 · $LaTeX$ 渲染 · 图片/PDF 附件 · vault 双链"
      milestone="M1-M2"
    />
  );
}

export function GraphView(): ReactNode {
  return (
    <Placeholder
      title="知识图谱"
      desc="React Flow 全局/局部图 · 双链与概念边可视化"
      milestone="M2 / M3b Knowledge Universe"
    />
  );
}

export function MindMapView(): ReactNode {
  return (
    <Placeholder
      title="思维导图"
      desc="旁车 json 结构真相 · 拖拽编辑 · AI 生成导图"
      milestone="M2b / M4"
    />
  );
}

export function TutorPanelView(): ReactNode {
  return (
    <Placeholder
      title="AI Tutor"
      desc="记忆感知讲解 · 上下文透视 · 自动更新掌握度"
      milestone="M4"
    />
  );
}

export function ReviewQueueView(): ReactNode {
  return (
    <Placeholder
      title="复习"
      desc="SM-2 复习队列 · 快速测验"
      milestone="M5"
    />
  );
}

export function MemoryDashboardView(): ReactNode {
  return (
    <Placeholder
      title="学习仪表盘"
      desc="四维掌握度雷达 · 学习时间线 · 遗忘预警"
      milestone="M3"
    />
  );
}
