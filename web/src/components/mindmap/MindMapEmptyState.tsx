/**
 * 思维母图空态（P1-4）——**纯展示组件**，无数据获取、无业务逻辑。
 *
 * 依据：ui/empty-states.html（ADR-013 §2.13 空态规范源）MindMap 定稿原型
 * `data-slot="mindmap-empty"`：eyebrow / 标题 / 描述 / CTA。
 *
 * 设计约束（P1-4 边界）：
 *   - 不改 MindMap API / sidecar / DB / 节点边模型 / import 逻辑
 *   - **唯一填充主 CTA**（规范硬门禁 #2）：「新建导图」= brand-deep 底白字；
 *     「导入」为 ghost 文字次 CTA（视觉从属，不抢主 CTA）
 *   - 无插画 / 无图标（ADR-013 §2.2 禁图标库与装饰 SVG）→ 标题 + 描述 + CTA 文字结构
 *   - 无动效（规范仅允许 hover 聚光变体；本处不启用）
 *
 * 注：`.sl*` 类未镜像进 web（web 全库零 `.sl`），故沿用 web 既有空态命名体系
 * `.editor-empty__title/__sub` 的量级与风格，避免引入第二套类名体系。
 */
export function MindMapEmptyState(props: {
  onCreate: () => void;
  onImport: () => void;
}) {
  return (
    <div className="mindmap-empty">
      <p className="mindmap-empty__title">还没有导图</p>
      <p className="mindmap-empty__desc">
        导图从一篇笔记展开，不需要从空白画布开始。
      </p>
      <div className="mindmap-empty__actions">
        <button
          type="button"
          className="mindmap-empty__cta"
          onClick={props.onCreate}
        >
          新建导图
        </button>
        <button
          type="button"
          className="mindmap-empty__cta-secondary"
          onClick={props.onImport}
        >
          导入
        </button>
      </div>
    </div>
  );
}
