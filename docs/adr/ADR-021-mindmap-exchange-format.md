# ADR-021: MindMap Exchange Format v1

> Status: Approved · Date: 2026-08-27
> 关联：ADR-001 Storage Layer · ADR-019 MindMap Boundary · M2b-003 Export/Import

---

## 1. Context

M2b-001/002 完成后，MindMap 数据存储于 SQLite（mind_maps + mind_map_nodes + mind_map_edges）。
M2b-003 需要导入导出能力。

需要冻结交换格式，否则：
- 导入导出格式不一致
- 未来版本升级无法兼容
- 跨设备同步时格式冲突

---

## 2. Decision

### 2.1 格式定义

MindMap Exchange Format v1（`.map.json`）：

```json
{
  "version": "1.0",
  "type": "mindmap",
  "exported_at": "2026-08-27T12:00:00Z",
  "map": {
    "title": "My Thinking Map",
    "nodes": [
      {
        "id": 1,
        "label": "Gradient Descent",
        "note": "优化算法核心",
        "concept_id": 5,
        "position": { "x": 100, "y": 200 }
      },
      {
        "id": 2,
        "label": "Future Plans",
        "note": null,
        "concept_id": null,
        "position": { "x": 300, "y": 100 }
      }
    ],
    "edges": [
      {
        "source": 1,
        "target": 2,
        "relation": "related"
      }
    ]
  }
}
```

### 2.2 字段规则

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| version | string | ✅ | 格式版本，当前 "1.0" |
| type | string | ✅ | 固定 "mindmap" |
| exported_at | string | ✅ | ISO 8601 时间戳 |
| map.title | string | ✅ | Map 标题 |
| map.nodes | array | ✅ | 节点列表 |
| map.nodes[].id | int | ✅ | 原始 ID（导入时可重映射） |
| map.nodes[].label | string | ✅ | 节点标签 |
| map.nodes[].note | string | ❌ | 用户备注 |
| map.nodes[].concept_id | int\|null | ❌ | Concept 引用（ nullable） |
| map.nodes[].position | {x,y} | ✅ | 画布坐标 |
| map.edges | array | ✅ | 边列表 |
| map.edges[].source | int | ✅ | 源节点 ID |
| map.edges[].target | int | ✅ | 目标节点 ID |
| map.edges[].relation | string | ❌ | 关系标签，默认 "related" |

### 2.3 导入规则

1. **ID 重映射**：导入时重新分配 ID，不保留原始 ID
2. **concept_id 验证**：如果 concept_id 非空，验证 concept 存在；不存在则置 NULL
3. **不创建 concept**：导入不自动创建 Concept（ADR-019 铁律）
4. **不修改 mastery**：导入不产生 learning_event / mastery 变化
5. **标题冲突**：同名 Map 允许存在（不覆盖）

### 2.4 导出范围

导出内容：
- Map metadata（title, created_at, updated_at）
- 所有 nodes（含 position, concept_id）
- 所有 edges（含 relation）

不导出：
- concept 详情（只保留 concept_id 引用）
- mastery 数据
- learning_events

### 2.5 版本兼容

- v1.0 只支持单个 Map 导出
- 未来版本可能支持多 Map 打包
- version 字段用于未来格式升级检测

---

## 3. Consequences

### 正面

- 格式冻结后，导入导出实现有明确规范
- concept_id 引用保持 ADR-019 边界
- 版本号支持未来格式升级

### 负面

- 单 Map 导出，不支持批量（v1 限制）
- 不支持增量导出（全量导出）

### 风险

- 大型 Map 导出文件可能较大（5000+ nodes）
- 导入时 concept_id 验证需要查询 DB

---

## 4. Implementation Notes

### 导出 API

```
GET /api/v1/mindmaps/{id}/export
→ application/json (MindMap Exchange Format v1)
```

### 导入 API

```
POST /api/v1/mindmaps/import
Body: MindMap Exchange Format v1 JSON
→ { id, title, node_count, edge_count }
```

### 前端交互

- 导出：点击 Map → Export → 下载 .map.json
- 导入：Maps 列表 → Import → 选择文件 → 预览 → 确认
