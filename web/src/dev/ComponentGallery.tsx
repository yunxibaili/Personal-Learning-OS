import { useState } from "react";

import {
  Button, Input, Tag, Badge, Skeleton, Progress, useToast,
  Select, Modal, Tooltip, SegmentedControl, Tabs, Switch,
} from "../components/ui";

/**
 * P1 组件活文档（dev-only，#gallery hash 入口）。
 * 仅 import.meta.env.DEV 构建包含；生产 build tree-shake 掉。
 */
export function ComponentGallery() {
  const toast = useToast();
  const [input, setInput] = useState("");
  const [tags, setTags] = useState(["特征值", "线性代数"]);
  const [sel, setSel] = useState("a");
  const [modal, setModal] = useState(false);
  const [seg, setSeg] = useState<"day" | "week">("day");
  const [tab, setTab] = useState<"outline" | "links">("outline");
  const [sw, setSw] = useState(true);

  return (
    <section style={{ maxWidth: 720, margin: "0 auto", padding: 24, display: "grid", gap: 32 }}>
      <h2 style={{ margin: 0 }}>P1 组件 Gallery（dev-only）</h2>

      <div>
        <h3>Button</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Button variant="primary">主要</Button>
          <Button variant="secondary">次要</Button>
          <Button variant="ghost">幽灵</Button>
          <Button variant="danger">危险</Button>
          <Button variant="primary" loading>加载中</Button>
          <Button variant="primary" disabled>禁用</Button>
          <Button size="sm">小号</Button>
          <Button size="lg">大号</Button>
        </div>
      </div>

      <div>
        <h3>Input</h3>
        <div style={{ display: "grid", gap: 12 }}>
          <Input label="标题" placeholder="输入笔记标题" value={input}
                 onChange={(e) => setInput(e.target.value)} />
          <Input label="带提示" hint="保存到 vault/ 笔记目录" />
          <Input label="带错误" error="标题不能为空" />
        </div>
      </div>

      <div>
        <h3>Tag / Badge</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {tags.map((t) => (
            <Tag key={t} tone="brand" onRemove={() => setTags(tags.filter((x) => x !== t))}>{t}</Tag>
          ))}
          <Tag>neutral</Tag>
          <Tag tone="ok">ok</Tag>
          <Tag tone="warn">warn</Tag>
          <Tag tone="err">err</Tag>
          <Tag tone="ink">ink</Tag>
          <Badge tone="brand">3</Badge>
          <Badge tone="err">!</Badge>
        </div>
      </div>

      <div>
        <h3>Progress / Skeleton</h3>
        <div style={{ display: "grid", gap: 8 }}>
          <Progress value={0.85} label="掌握度 85%" />
          <Progress value={0.5} label="掌握度 50%" />
          <Progress value={0.2} label="掌握度 20%" />
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Skeleton variant="circle" width={32} height={32} />
            <Skeleton variant="text" width={200} />
            <Skeleton variant="rect" width={120} height={64} />
          </div>
        </div>
      </div>

      <div>
        <h3>Select / Switch / Segmented / Tabs / Tooltip</h3>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          <Select label="领域" value={sel} onChange={(e) => setSel(e.target.value)}
                  options={[{ value: "a", label: "数学" }, { value: "b", label: "编程" }]} />
          <Select label="带错误" error="必选" options={[{ value: "", label: "请选择" }]} />
          <Switch checked={sw} onChange={setSw} label="自动同步" />
          <SegmentedControl ariaLabel="时间范围" value={seg} onChange={setSeg}
                            options={[{ value: "day", label: "今天" }, { value: "week", label: "本周" }]} />
          <Tooltip content="提示文案">
            <Button variant="ghost">hover 我</Button>
          </Tooltip>
        </div>
        <div style={{ marginTop: 12 }}>
          <Tabs value={tab} onChange={setTab}
                tabs={[{ key: "outline", label: "大纲" }, { key: "links", label: "反链" }]} />
        </div>
        <div style={{ marginTop: 12 }}>
          <Button variant="secondary" onClick={() => setModal(true)}>打开 Modal</Button>
          <Modal open={modal} title="确认删除" onClose={() => setModal(false)}
                 footer={<>
                   <Button variant="ghost" onClick={() => setModal(false)}>取消</Button>
                   <Button variant="danger" onClick={() => { setModal(false); toast.push("已删除", "err"); }}>删除</Button>
                 </>}>
            删除后该笔记将从 vault 移除，此操作不可撤销。
          </Modal>
        </div>
      </div>

      <div>
        <h3>Toast</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button onClick={() => toast.push("已保存到 vault", "ok")}>成功 Toast</Button>
          <Button onClick={() => toast.push("同步失败，将自动重试", "err")}>错误 Toast</Button>
          <Button onClick={() => toast.push("普通提示", "neutral")}>中性 Toast</Button>
        </div>
      </div>
    </section>
  );
}
