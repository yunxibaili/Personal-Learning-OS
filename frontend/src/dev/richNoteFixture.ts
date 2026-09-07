/**
 * 真实内容测试夹具（Phase 3R.2 · 指令书 §36 Real Content Rule）。
 * 1200+ 字中文知识长文，覆盖全部块型：H2/H3/段落/列表/引用/代码/wikilink/图片占位/hr。
 * 仅用于视觉校准页与长会话测试（内存对象，不写入 vault）。
 */
import type { NoteDetail } from "../api/notes";

export const RICH_NOTE_TITLE = "梯度下降与优化器全景";

export const RICH_NOTE_CONTENT = `# 梯度下降与优化器全景

机器学习的本质，是让计算机从数据中学习规律。而学习的核心优化方法，就是**梯度下降**：沿负梯度方向迭代更新参数，以最小化损失函数。

## 基本形式

参数更新的单步公式如下：

$$\\theta_{t+1} = \\theta_t - \\eta \\cdot \\nabla L(\\theta_t)$$

其中 $\\eta$ 即学习率。学习率是最关键的超参数：太大会震荡发散，太小会收敛缓慢。工程上最常用的自适应变体是 \`Adam\` 优化器，它结合了动量与二阶矩估计。

> 直觉上，梯度下降像下山：每一步都沿当前最陡的下坡方向走一小段，步长由学习率决定。

## 常见变体

- **批量梯度下降**：全数据计算梯度，稳定但慢。
- **随机梯度下降（SGD）**：单样本估计，快但噪声大。
- **小批量（Mini-batch）**：工程默认，兼顾速度与稳定性。
- **Momentum**：累积历史方向，冲过局部平坦区。
- **Adam / AdamW**：自适应学习率 + 解耦权重衰减。

## 与注意力机制的关系

在\`Transformer\`架构中，注意力的参数同样靠梯度下降训练。可参见 [[Transformer]] 与 [[注意力机制]] 的推导；反向传播部分见 [[反向传播]]，二阶优化思想见 [[Adam优化器]]。

## 常见陷阱

1. 学习率过大导致损失震荡——先做学习率范围扫描。
2. 局部极小值与鞍点在高维空间中比想象中少见。
3. 梯度消失需要归一化或残差连接配合。

---

## 学习检查点

- 能否不看资料写出单步更新公式？
- 能否解释 Momentum 为什么能冲过平坦区？
- 能否说出 AdamW 与 Adam 的区别？

相关阅读：[[反向传播]] · [[学习率调度]] · [[损失函数]]

![梯度下降示意图](https://example.com/gd.png)`;

export const RICH_NOTE: NoteDetail = {
  id: 900001,
  title: RICH_NOTE_TITLE,
  path: "学习/优化器全景.md",
  tags: ["机器学习", "优化"],
  updated_at: "2026-09-07T09:00:00Z",
  parent_id: null,
  content_md: RICH_NOTE_CONTENT,
};
