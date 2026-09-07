这份 Blueprint 已经比前两轮成熟很多。**我认为可以批准进入实施，但建议先修正 4 个设计上的隐患，再让 Agent 开 3C-1。**

我先按你给出的 Blueprint 本身审，不把没有看到的截图当成证据。若要判断中文标题、2560 空间感、Context 的“苹果味”是否真的成立，截图会很有帮助：

### 我认为做得对的地方

最大的进步是它终于抓到了真正的问题：

> **OLOS 缺的不是 Apple 组件，而是空间组织。**

尤其这三个决策是对的：

**Context = companion layer**  
**Peek = edge-aware**  
**大屏 = contextual margin**

这比简单把 `reader 680 → 900px` 要高级得多，也更符合你之前确定的：

> One object in focus, everything else stays close, contextual, and reversible.

另外，\*\*“玻璃不再增加”\*\*这个判断非常重要。现在继续堆 Liquid Glass 已经没有收益，反而容易破坏 OLOS 最大的优势——内容层纪律。

---

## 但我建议实施前修改 4 个地方

### 1. `Work Surface ≥ 680` 不应该成为所有状态的绝对硬约束

Blueprint 写的是：

> `minmax(680px, 1fr)`

然后又规定：

> 1280 Explorer + Context companion

这里实际上存在潜在冲突。

例如：

```text
1280
Rail       52
Explorer   264
Surface    680
Context    320
----------------
1316
```

已经超过可用宽度。

所以真正应该定义的是：

```text
Desktop primary invariant:
Work Surface has priority.

Preferred:
reader measure 680–760

Minimum:
Work Surface itself may shrink only after
secondary panes yield/overlap/hide.
```

也就是：

**680 是 Reading Measure 的目标，不应该成为 Layout Engine 无条件的物理最小宽度。**

否则 1280 会为了守住 680 把 Explorer / Context 搞得很别扭。

建议 3C-1 明确：

```text
Priority:
Work Surface
>
Context
>
Explorer
>
Decorative margin
```

Context 和 Explorer 必须是**可让位的 pane**。

---

### 2. Context companion 不应该一开始就设计成“固定 320px 侧栏的另一种写法”

这是我最警惕的地方。

Blueprint 现在概念上是：

> companion layer

很好。

但实施时如果最后变成：

```text
reader
           [320px Context]
```

只是把右侧 Panel 从 window edge 搬到了 reader edge。

那实际上没有解决本质问题。

真正应该是：

```text
contextual margin
        ┌──────────────────────┐
        │   annotation / peek  │
        │                      │
        │        Reader        │ Context
        │        680           │
        │                      │
        └──────────────────────┘
```

Context 应该具备：

- anchor
- density
- temporal relevance
- hide/show
- recomposition

而不是单纯：

> “右边有一个 320px 的东西”。

**这应该成为 3C-2 的核心验收标准。**

---

### 3. 2560 的“Contextual Margin”第一版不要马上做 `AnnotationMargin`

Blueprint 直接规划了：

> 新 `AnnotationMargin.tsx`

我建议稍微谨慎。

因为你现在还没有真正的持久 Annotation 模型。

如果第一阶段为了填充 2560 空间，做一个：

> 看起来像 annotation rail 的东西

很容易重新走向“为了大屏填空间”。

更合理的顺序：

```text
2560
↓
Reader
↓
real margin
↓
Peek
↓
Context
↓
existing backlink/reference
↓
未来 Annotation
```

先让**真实存在的知识关系**占据边距。

AnnotationMargin 可以先作为：

> layout host

而不是马上成为一个独立信息系统。

这样就不会提前设计 Phase 4 的数据模型。

---

### 4. Compare 的“5 个动作”不要一次全部塞进视觉层

这个 Blueprint 的动作集合：

```text
Compare
Relate
Open Source
Add to Review
Ask Tutor
```

语义上没问题。

但如果全部直接放在 Compare Header：

```text
[Compare] [Relate] [Source] [Review] [Tutor]
```

马上就会破坏你现在非常好的：

> Quiet Controls

所以我建议：

**Compare Header 只保留一个 primary action + 一个关系入口。**

其他动作进入 contextual menu / overflow。

例如：

```text
Compare                        ⋯
```

里面：

```text
Compare
Relate
Open Source
Add to Review
Ask Tutor
```

根据当前对象关系动态决定哪些出现。

这会更接近 Apple 的“功能很多，但视觉上很少”。

---

# 所以我对 Blueprint 的最终评价

我会给：

**A- / 可以实施**

不是 A 的原因不是方案错误，而是：

> **Layout / Context / Large Screen 还有一个“实现时很容易重新 Panel 化”的风险。**

目前最重要的不是再研究更多网站了。

**研究阶段已经够了。**

现在继续搜索 20 个产品的边际收益，已经远低于真正开始做：

```text
3C-1 Layout Foundation
```

---

# 下一步应该真的开始 3C-1

而且我建议你给新 AI 的下一条指令，不要让它自己自由发挥。

直接锁死：

**执行对象：UI 优化 Agent**

第一阶段只做：

```text
P0 Grid
+
Workbench Header
+
Large Title → Compact Title
+
Tab Morph
```

暂时**不要做**：

```text
Context v2
Peek v2
Compare v2
AnnotationMargin
Math
KaTeX
```

因为这样能先得到一个干净的：

> **Spatial Foundation**

然后再在这个空间基础上放 Context / Peek。

如果先把 Context、Peek、Compare 全一起改，很容易无法判断到底是 layout 对了，还是 panel 只是换了位置。

我建议下一步就让 Agent 按 **3C-1 Layout Foundation** 开工，而且把上述 4 点修正直接写进执行约束。







