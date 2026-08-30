/**
 * UniverseInteractionPreview（P8-001C-Preview · @property 椭圆公转）
 *
 * 参考：Will Boyd "Making Orbit Animations with CSS Custom Properties"
 * 技术：@property --angle 驱动 calc(cos/sin) → 椭圆轨迹
 *       @property --z → 节点前后遮挡（公转到背面时 z-index 降低）
 */
import { useState, type CSSProperties } from "react";

import "./preview.css";

interface DemoConcept {
  id: string;
  name: string;
  domain: string;
  mastery: number;
  links: number;
  r: number; // 轨道半径（px）
  angle: number; // 初始相位（度）
}

const DEMO_EDGES: Array<[string, string]> = [
  ["ml", "supervised"],
  ["ml", "unsupervised"],
  ["gd", "adam"],
  ["gd", "loss"],
  ["transformer", "attention"],
  ["transformer", "backprop"],
  ["llm", "rlhf"],
  ["transformer", "llm"],
  ["ml", "gd"],
];

const DEMO_NODES: DemoConcept[] = [
  // ML 域
  { id: "ml",           name: "机器学习",     domain: "ML",            mastery: 0.82, links: 8,  r: 340, angle: 10 },
  { id: "supervised",   name: "监督学习",     domain: "ML",            mastery: 0.55, links: 4,  r: 250, angle: 55 },
  { id: "unsupervised", name: "无监督学习",   domain: "ML",            mastery: 0.3,  links: 3,  r: 300, angle: 125 },
  // Optimization 域
  { id: "gd",     name: "梯度下降",   domain: "Optimization", mastery: 0.72, links: 12, r: 280, angle: 200 },
  { id: "adam",   name: "Adam优化器", domain: "Optimization", mastery: 0.6,  links: 7,  r: 320, angle: 260 },
  { id: "loss",   name: "损失函数",   domain: "Optimization", mastery: 0.25, links: 9,  r: 200, angle: 315 },
  // Deep Learning 域
  { id: "transformer", name: "Transformer",  domain: "Deep Learning", mastery: 0.88, links: 15, r: 340, angle: 155 },
  { id: "attention",   name: "注意力机制",   domain: "Deep Learning", mastery: 0.66, links: 10, r: 260, angle: 285 },
  { id: "backprop",    name: "反向传播",     domain: "Deep Learning", mastery: 0.5,  links: 6,  r: 300, angle: 345 },
  // NLP 域
  { id: "llm",   name: "大语言模型", domain: "NLP",            mastery: 0.45, links: 8,  r: 220, angle: 80 },
  { id: "rlhf",  name: "RLHF",      domain: "NLP",            mastery: 0.35, links: 5,  r: 350, angle: 15 },
];

/** 基础公转周期（秒） */
const BASE_PERIOD = 60;

/** 椭圆轨道环（按 r 聚类，显示代表性几圈） */
const ORBIT_RINGS: number[] = (() => {
  const seen = new Map<number, number>();
  for (const n of DEMO_NODES) {
    const key = Math.round(n.r / 80) * 80;
    if (!seen.has(key)) seen.set(key, n.r);
  }
  return [...seen.values()].sort((a, b) => a - b);
})();

function masteryDot(m: number): string {
  if (m >= 0.8) return "var(--green)";
  if (m >= 0.5) return "var(--accent)";
  return "var(--warm)";
}

export function UniverseInteractionPreview() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [coreHover, setCoreHover] = useState(false);

  const isFocus = selectedId !== null;
  const selected = selectedId ? DEMO_NODES.find((n) => n.id === selectedId) ?? null : null;

  // 邻居计算
  const neighbors = new Set<string>();
  if (hoveredId) {
    for (const [a, b] of DEMO_EDGES) {
      if (a === hoveredId) neighbors.add(b);
      if (b === hoveredId) neighbors.add(a);
    }
  }

  const handleNodeClick = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  const masteryLabel = (m: number) => (m >= 0.8 ? "mastered" : m >= 0.5 ? "learning" : "new");

  return (
    <div className="preview-wrap">
      <div className="kc-header">
        <span className="kc-title">Knowledge Universe</span>
        <span className="kc-hint">
          hover → 浮起 + 关联响应 · 点击 → Focus · 节点沿椭圆轨道公转
        </span>
      </div>

      <div className={`kc-canvas${isFocus ? " focusing" : ""}`}>
        {/* 中央球体 */}
        <div
          className={`kc-core${coreHover ? " core-hover" : ""}`}
          onMouseEnter={() => setCoreHover(true)}
          onMouseLeave={() => setCoreHover(false)}
        >
          <div className="kc-earth" />
          <span className="kc-earth-label">Knowledge</span>
        </div>

        {/* 圆形轨道痕迹 */}
        {ORBIT_RINGS.map((r, i) => (
          <div
            key={i}
            className="kc-orbit-ring"
            style={{ width: r * 2, height: r * 2 }}
          />
        ))}

        {/* 概念节点（@property 椭圆公转） */}
        {DEMO_NODES.map((n) => {
          const isHovered = hoveredId === n.id;
          const isNeighbor = neighbors.has(n.id);
          const isSelected = selectedId === n.id;
          const isDimmed = isFocus && !isSelected;

          let cls = "kc-node";
          if (isHovered) cls += " node-hover";
          if (isNeighbor && !isHovered) cls += " node-related";
          if (isSelected) cls += " node-selected";
          if (isDimmed) cls += " node-dimmed";

          // animation-delay 偏移：按初始相位分配，避免同时出发碰撞
          const delay = -(n.angle / 360) * BASE_PERIOD;

          // 周期：轨道越大越慢
          const period = BASE_PERIOD * (n.r / 340);

          return (
            <div
              key={n.id}
              className={cls}
              style={
                {
                  "--r": `${n.r}px`,
                  "--period": `${period}s`,
                  animationDelay: `${delay}s`,
                } as CSSProperties
              }
              onMouseEnter={() => setHoveredId(n.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => handleNodeClick(n.id)}
            >
              <div className="kc-inner">
                <span
                  className="kc-dot"
                  style={{ background: masteryDot(n.mastery) }}
                />
                <span className="kc-node-name">{n.name}</span>
              </div>
            </div>
          );
        })}

        {/* Floating Inspector */}
        {selected && (
          <div className="kc-inspector">
            <div className="kc-ins-title">{selected.name}</div>
            <div className="kc-ins-domain">{selected.domain}</div>
            <div className="kc-ins-row">
              <span>Mastery</span>
              <span>
                {masteryLabel(selected.mastery)} · {Math.round(selected.mastery * 100)}%
              </span>
            </div>
            <div className="kc-ins-row">
              <span>Links</span>
              <span>{selected.links}</span>
            </div>
            <div className="kc-ins-hint">点击空白处退出 Focus</div>
          </div>
        )}
      </div>
    </div>
  );
}
