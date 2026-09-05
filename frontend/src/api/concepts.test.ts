// concepts 消费端测试：列表投影/mastery null、domains、详情、graph 关系邻接、坏形状。
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./client";
import { getConcept, getConceptDomains, getConceptRelatedNotes, listConcepts } from "./concepts";

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const CONCEPT = {
  id: 1, title: "注意力", aliases: [], summary: "s", domain: "机器学习",
  origin: "markdown", created_at: "t1", updated_at: "t2", status: "active", mastery: null,
};

describe("listConcepts", () => {
  it("发送 status/limit/offset/domain 参数", async () => {
    const fetchMock = mockFetch(200, { concepts: [] });
    await listConcepts({ domain: "机器学习", status: "active", limit: 50, offset: 50 });
    const [url] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toBe(
      `/api/v1/concepts?${new URLSearchParams({
        status: "active", limit: "50", offset: "50", domain: "机器学习",
      }).toString()}`,
    );
  });

  it("投影 concepts；mastery null 保留为 null", async () => {
    mockFetch(200, { concepts: [CONCEPT] });
    const list = await listConcepts({ status: "active", limit: 50, offset: 0 });
    expect(list[0].mastery).toBeNull();
    expect(list[0].domain).toBe("机器学习");
  });

  it("缺 concepts 数组 → contract_mismatch", async () => {
    mockFetch(200, {});
    const err = await listConcepts({ status: "active", limit: 50, offset: 0 }).catch((e: unknown) => e);
    expect((err as ApiError).code).toBe("contract_mismatch");
  });
});

describe("getConceptDomains", () => {
  it("投影 domains，过滤非字符串项", async () => {
    mockFetch(200, { domains: ["算法", 42, "机器学习"] });
    expect(await getConceptDomains()).toEqual(["算法", "机器学习"]);
  });
});

describe("getConcept", () => {
  it("带 mastery 投影的详情", async () => {
    mockFetch(200, { ...CONCEPT, mastery: { effective: 0.3, knowledge: 0.5, practice: 0, recall: 0.2, transfer: 0 } });
    const c = await getConcept(1);
    expect(c.mastery?.effective).toBe(0.3);
  });

  it("路径参数替换（{concept_id} 不出现在 URL）", async () => {
    const fetchMock = mockFetch(200, CONCEPT);
    await getConcept(7);
    const [url] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toBe("/api/v1/concepts/7");
  });
});

describe("getConceptRelatedNotes", () => {
  it("按 edges 取 concept 的 note 邻居（不过滤 relation 类型，后端投影为准）", async () => {
    mockFetch(200, {
      nodes: [
        { id: "concept-1", type: "concept", ref_id: 1, title: "注意力" },
        { id: "note-2", type: "note", ref_id: 2, title: "注意力机制" },
        { id: "note-5", type: "note", ref_id: 5, title: "孤立笔记" },
        { id: "concept-9", type: "concept", ref_id: 9, title: "深度学习" },
      ],
      edges: [
        { source: "note-2", target: "concept-1", relation: "wikilink" },
        { source: "concept-9", target: "concept-1", relation: "related" },
      ],
    });
    expect(await getConceptRelatedNotes(1)).toEqual([{ note_id: 2, title: "注意力机制" }]);
  });

  it("缺 nodes/edges → contract_mismatch", async () => {
    mockFetch(200, { nodes: [] });
    const err = await getConceptRelatedNotes(1).catch((e: unknown) => e);
    expect((err as ApiError).code).toBe("contract_mismatch");
  });
});
