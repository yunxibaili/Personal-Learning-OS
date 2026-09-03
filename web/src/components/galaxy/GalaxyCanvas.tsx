import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiGet } from "../../lib/api";
import { useUi } from "../../stores/ui";
import { Button, Skeleton } from "../ui";
import type { GraphNode, GraphResponse } from "@shared/types/graph";
import type { NoteDetailResponse } from "@shared/types/note";

/**
 * GalaxyCanvas（Phase 3 ⑤）——「多星球系统」：主笔记=星球，副笔记=卫星。
 *
 * 层级来源（ADR-024 P0 后）：**显式 parent（frontmatter）优先**——`/graph`
 * 返回 `relation="parent"` 权威边，见 `derivePlanets` 的 explicit 分支；
 * wikilink 拓扑推断仅作 legacy fallback（2026-08-31 方案 A，保留于
 * `derivePlanetsHeuristic`）：
 *   · 星球（hub）= 出度 ≥ HUB_MIN_OUT 的笔记（它链出去多 = 目录/书级）
 *   · 卫星 = 与该 hub **双向互链**的笔记（单向不认，避免把偶然引用当从属）
 *   · 归属排他：一个卫星只归给互链 hub 中出度最大的那个
 *     （裁决 4：卫星只属于它自己那颗星球）
 *   · 孤立笔记（入度=出度=0）= 无卫星的独立小星球
 *
 * 渲染逻辑逐字移植自 ui/home-hero.html 的地球引擎（不可回退的实现约束）：
 *   1. 点阵世界贴图 assets/dots-world.png，正像+镜像预拼无缝长条，横向滚动 = 自转
 *   2. 白底球 + 径向暗角 + 顶部柔光 + 外圆细描边
 *   3. 轨道环分前后半段绘制（sin(t) 判深度）实现星球遮挡
 *   4. 拖尾卫星：墨色渐隐拖尾 + 圆点
 *
 * 性能契约（UI_DESIGN §10）：单 rAF · 30fps 节流 · 全屏 dpr≤1.5 / 卡片 dpr=1 ·
 * 离屏与隐藏暂停 · reduced-motion 停全部 · 循环内无 getComputedStyle / 无 DOM 重建 ·
 * 卫星上限 16（超出聚合「…+N」）· 公转 72s/圈。
 *
 * 配色（裁决 4 + 裁决 6）：中性墨色 + 灰阶；橙色 `--brand` **只**出现在 mastery 弧与选中态。
 */

const FPS = 30;
const FRAME_MS = 1000 / FPS;
const REF_CANVAS = 600;
const REF_PLANET_R = 200;

/** 轨道：rx/ry 相对星球半径；tilt 为轨道倾角（弧度）。 */
const ORBITS = [
  { rx: 1.32, ry: 0.36, tilt: -0.18 },
  { rx: 1.48, ry: 0.42, tilt: 0.42 },
  { rx: 1.64, ry: 0.48, tilt: -0.62 },
  { rx: 1.76, ry: 0.32, tilt: 0.85 },
];

/**
 * P1-9-P1：**轨道数量 = 卫星数的受限函数**（纯渲染层，零数据/算法改动）。
 *
 * 背景：ORBITS 是固定 4 条，原先无论有无卫星都全部绘制 → 0 卫星的星球仍画 4 圈空轨道，
 * 放大「空旷」观感（P1-9 取证：18 颗星球里 16 颗 0 卫星）。
 *
 * 规则（确定性）：0 卫星 → 0 条；1 卫星 → 1 条；≥2 卫星 → 2 条。
 * 纯函数 + 单测锁定（orbitCount.test.ts），防止回退成固定 4 圈。
 */
export function orbitCountFor(satCount: number): number {
  if (!satCount || satCount <= 0) return 0;
  return satCount === 1 ? 1 : 2;
}

const SAT_PERIOD = 72; // 契约：公转 72s/圈
const TRAIL_RAD = 1.1;
const TRAIL_SEGS = 9;
const MAX_SATS = 16; // 契约：卫星渲染上限
const HUB_MIN_OUT = 2; // 星球判定阈值：出度 ≥2

const MIN_SAT_PX = 3.2;
const MAX_SAT_PX = 13;
const SAT_WORDS_DIV = 260;

/**
 * 右栏 minimap 画布尺寸（P1-7）：与 styles/tokens.css 的 `--galaxy-mini-size` 对应，
 * 两处必须一致（CSS 驱动容器高度与 canvas flex-basis，这里驱动绘制尺寸）。
 * 保持 ≤320 → GalaxyCanvas 内部 dpr 恒为 1（`size <= 320 ? 1 : ...`），不上采样。
 */
const GALAXY_MINI_SIZE = 224;

const INK = [32, 34, 40]; // #202228 墨色
const BRAND = "#FF6B35"; // --brand：仅 mastery 弧与选中态
const RING = "rgba(150,150,150,0.32)";
const PLANET_EDGE = "rgba(150,150,150,0.55)";
const INK_HEX = "#202228";

interface SatNote {
  id: number;
  title: string;
  words: number;
  size: number;
  orbit: number;
  phase: number;
  speed: number;
  mastery: number | null;
}

export interface Planet {
  /** 主笔记 id */
  id: number;
  title: string;
  sats: SatNote[];
  /** 超出渲染上限的卫星数（>0 时绘「…+N」） */
  overflow: number;
  /** 星球掌握度 = 卫星 mastery 均值；无数据为 null */
  mastery: number | null;
}

// ---------------------------------------------------------------- 数据层

function addTo(m: Map<number, Set<number>>, k: number, v: number) {
  const s = m.get(k);
  if (s) s.add(v);
  else m.set(k, new Set([v]));
}

/**
 * 生成星球/卫星。纯函数，便于单测。
 * ADR-024：`relation='parent'` 为**权威**层级（显式主/副）；无 parent 边时回退到
 * wikilink 拓扑推断（legacy）。@param g `/graph` 响应
 */
export function derivePlanets(g: GraphResponse): Planet[] {
  const byKey = new Map(g.nodes.map((n) => [n.id, n]));
  const noteTitle = new Map<number, string>();
  const noteMastery = new Map<number, number | null>();
  for (const n of g.nodes) {
    if (n.type !== "note") continue;
    noteTitle.set(n.ref_id, n.title);
    noteMastery.set(n.ref_id, n.learning?.mastery ?? null);
  }

  // 权威 parent 关系（ADR-024 §2.2 铁规则 4）：child -> parent
  const parentEdges: Array<[number, number]> = [];
  for (const e of g.edges) {
    if (e.relation !== "parent") continue;
    const a = byKey.get(e.source);
    const b = byKey.get(e.target);
    if (!a || !b || a.type !== "note" || b.type !== "note") continue;
    parentEdges.push([a.ref_id, b.ref_id]);
  }
  if (parentEdges.length > 0) {
    return derivePlanetsExplicit(parentEdges, noteTitle, noteMastery);
  }
  return derivePlanetsHeuristic(g, byKey, noteTitle, noteMastery);
}

/** 显式 parent（权威）：星球 = 有孩子的笔记（或孤立根），卫星 = 其 direct child。 */
function derivePlanetsExplicit(
  parentEdges: Array<[number, number]>,
  noteTitle: Map<number, string>,
  noteMastery: Map<number, number | null>,
): Planet[] {
  const satsOf = new Map<number, number[]>();
  for (const [c, p] of parentEdges) {
    const arr = satsOf.get(p);
    if (arr) arr.push(c);
    else satsOf.set(p, [c]);
  }
  const hasParent = new Set(parentEdges.map(([c]) => c));
  const isPlanet = new Set<number>();
  for (const pid of satsOf.keys()) isPlanet.add(pid); // 有孩子的 = 星球
  for (const id of noteTitle.keys()) {
    // 孤立根（既无 parent 也无 child）= 独立小星球
    if (!hasParent.has(id) && !satsOf.has(id)) isPlanet.add(id);
  }

  const mkPlanet = (id: number): Planet => ({
    id,
    title: noteTitle.get(id) ?? "未命名",
    sats: [],
    overflow: 0,
    mastery: null,
  });
  const planets = [...isPlanet].map(mkPlanet);
  for (const p of planets) {
    const ids = (satsOf.get(p.id) ?? []).sort((a, b) => a - b);
    p.overflow = Math.max(0, ids.length - MAX_SATS);
    const ms = ids.map((i) => noteMastery.get(i) ?? null).filter((v): v is number => v !== null);
    p.mastery = ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : noteMastery.get(p.id) ?? null;
    p.sats = ids.slice(0, MAX_SATS).map((id, i) => ({
      id,
      title: noteTitle.get(id) ?? "未命名",
      words: 0,
      size: MIN_SAT_PX,
      orbit: i % ORBITS.length,
      phase: (i * 137.5 * Math.PI) / 180,
      speed: (Math.PI * 2) / SAT_PERIOD,
      mastery: noteMastery.get(id) ?? null,
    }));
  }
  return planets.sort((a, b) => b.sats.length - a.sats.length || a.title.localeCompare(b.title));
}

/** legacy：从 wikilink 拓扑推断星球/卫星（无显式 parent 边时使用）。 */
function derivePlanetsHeuristic(
  g: GraphResponse,
  byKey: Map<string, GraphNode>,
  noteTitle: Map<number, string>,
  noteMastery: Map<number, number | null>,
): Planet[] {
  const out = new Map<number, Set<number>>();
  const inn = new Map<number, Set<number>>();
  for (const e of g.edges) {
    const a = byKey.get(e.source);
    const b = byKey.get(e.target);
    if (!a || !b || a.type !== "note" || b.type !== "note") continue;
    addTo(out, a.ref_id, b.ref_id);
    addTo(inn, b.ref_id, a.ref_id);
  }

  const outDeg = (id: number) => out.get(id)?.size ?? 0;
  const hubs = [...noteTitle.keys()]
    .filter((id) => outDeg(id) >= HUB_MIN_OUT)
    .sort((a, b) => outDeg(b) - outDeg(a) || a - b); // 出度降序：大 hub 先认领
  const hubSet = new Set(hubs);

  /**
   * 卫星归属（排他）。
   * 两条约束缺一不可：
   *  ① 必须双向互链——单向引用只是顺手一提，不算从属；
   *  ② 只能归属于**严格更大**的 hub（outDeg(s) < outDeg(h)）。
   *     放宽 ① 会让偶然引用变卫星；去掉 ② 则两个 hub 会互相吞并
   *     （A 认 B 为卫星、B 也认 A 为卫星），归属失去方向。
   * 被收编的 hub 降级为卫星（嵌套：卷属于丛书），不再单独成星球。
   */
  const owner = new Map<number, number>();
  for (const h of hubs) {
    for (const s of out.get(h) ?? []) {
      if (s === h) continue;
      if (!(inn.get(h)?.has(s) ?? false)) continue; // ① 双向
      if (outDeg(s) >= outDeg(h)) continue; // ② 严格更大
      const cur = owner.get(s);
      if (cur === undefined || outDeg(h) > outDeg(cur)) owner.set(s, h);
    }
  }

  const satsOf = new Map<number, number[]>();
  for (const [s, h] of owner) {
    const arr = satsOf.get(h);
    if (arr) arr.push(s);
    else satsOf.set(h, [s]);
  }

  const mkPlanet = (id: number): Planet => ({
    id,
    title: noteTitle.get(id) ?? "未命名",
    sats: [],
    overflow: 0,
    mastery: null,
  });

  const planets: Planet[] = [];
  // 星球 = 未被更大 hub 收编的 hub
  for (const h of hubs) {
    if (owner.has(h)) continue; // 已被收编 → 它只是别人的卫星
    planets.push(mkPlanet(h));
  }
  // 孤立笔记 = 无卫星的独立星球（既非 hub 也未被认领，避免出现无星球孤儿）
  for (const id of noteTitle.keys()) {
    if (hubSet.has(id) || owner.has(id)) continue;
    planets.push(mkPlanet(id));
  }

  for (const p of planets) {
    const ids = (satsOf.get(p.id) ?? []).sort((a, b) => a - b);
    p.overflow = Math.max(0, ids.length - MAX_SATS);
    const ms = ids.map((i) => noteMastery.get(i) ?? null).filter((v): v is number => v !== null);
    p.mastery = ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : noteMastery.get(p.id) ?? null;
    p.sats = ids.slice(0, MAX_SATS).map((id, i) => ({
      id,
      title: noteTitle.get(id) ?? "未命名",
      words: 0,
      size: MIN_SAT_PX, // 字数取回前用最小尺寸，取回后回填
      orbit: i % ORBITS.length,
      phase: (i * 137.5 * Math.PI) / 180, // 黄金角错相
      speed: (Math.PI * 2) / SAT_PERIOD, // 契约：72s/圈（各轨道同周期，靠倾角错开）
      mastery: noteMastery.get(id) ?? null,
    }));
  }

  // 星球多的排前面；同级按标题稳定排序
  return planets.sort((a, b) => b.sats.length - a.sats.length || a.title.localeCompare(b.title));
}

export interface GalaxyState {
  planets: Planet[];
  loading: boolean;
  error: string;
}

/** 拉取 `/graph` 并推断星系。多实例共享一次请求结果（模块级缓存）。 */
let graphCache: Promise<GraphResponse> | null = null;
function fetchGraph(): Promise<GraphResponse> {
  if (!graphCache) {
    graphCache = apiGet<GraphResponse>("/graph?depth=2").catch((e) => {
      graphCache = null; // 失败不缓存，允许重试
      throw e;
    });
  }
  return graphCache;
}

export function useGalaxy(): GalaxyState {
  const [planets, setPlanets] = useState<Planet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchGraph()
      .then((g) => {
        if (!alive) return;
        setPlanets(derivePlanets(g));
        setError("");
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { planets, loading, error };
}

/** 字数缓存：仅取回当前显示星球的卫星，避免全量 N+1 请求。 */
const wordsCache = new Map<number, number>();

/**
 * 无缝贴图（正像 + 水平镜像）全进程只拼一次，多实例共享。
 * 不挂 window：避免污染全局与额外的类型声明。
 */
let seamlessTexture: HTMLCanvasElement | null = null;

const satSize = (w: number) => Math.min(MIN_SAT_PX + w / SAT_WORDS_DIV, MAX_SAT_PX);

// ---------------------------------------------------------------- 渲染层

export interface GalaxyCanvasProps {
  /** 像素边长（正方形 canvas） */
  size: number;
  /** 要绘制的星球；null 时只画空轨道骨架 */
  planet: Planet | null;
  /** true = 自转 + 卫星公转；false = 静止帧（右栏形态：卫星不转） */
  animate: boolean;
  /** 当前打开的笔记（橙色选中态；命中星球或卫星任一） */
  activeNoteId?: number | null;
  onSatelliteClick?: (noteId: number) => void;
}

export function GalaxyCanvas({
  size,
  planet,
  animate,
  activeNoteId = null,
  onSatelliteClick,
}: GalaxyCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const satsRef = useRef<SatNote[]>([]);
  const headPosRef = useRef<Array<{ id: number; x: number; y: number; r: number }>>([]);
  const [textureReady, setTextureReady] = useState(!!seamlessTexture);

  // 卫星尺寸：字数来自 note detail，按需取 + 缓存（本地回环，≤16 次）
  const planetId = planet?.id ?? null;
  useEffect(() => {
    if (planetId === null) return;
    const p = planet;
    if (!p) return;
    let alive = true;
    const need = p.sats.filter((s) => !wordsCache.has(s.id));
    const apply = () => {
      if (!alive) return;
      p.sats.forEach((s) => {
        s.words = wordsCache.get(s.id) ?? 0;
        s.size = satSize(s.words);
      });
      satsRef.current = p.sats;
    };
    if (need.length === 0) {
      apply();
      return;
    }
    void Promise.all(
      need.map((s) =>
        apiGet<NoteDetailResponse>(`/notes/${s.id}`)
          .then((d) => {
            wordsCache.set(s.id, d.note.content_md.length);
          })
          .catch(() => {
            wordsCache.set(s.id, 0);
          }),
      ),
    ).then(apply);
    return () => {
      alive = false;
    };
  }, [planetId, planet]);

  // 贴图加载（正像+镜像 → 无缝长条）
  useEffect(() => {
    if (seamlessTexture) return; // 全进程只拼一次
    const img = new Image();
    img.onload = () => {
      const seamless = document.createElement("canvas");
      seamless.width = img.width * 2;
      seamless.height = img.height;
      const s = seamless.getContext("2d");
      if (!s) return;
      s.drawImage(img, 0, 0);
      s.drawImage(img, img.width, 0);
      seamlessTexture = seamless;
      setTextureReady(true);
    };
    img.src = "/assets/dots-world.png";
  }, []);

  // 渲染引擎
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // 契约：全屏 dpr≤1.5；小尺寸（≤320）supersample 2× 防摩尔纹——
    // dot-earth 点阵纹理在小尺寸 dpr=1 时点距低于像素级产生混叠（所有者反馈）。
    // 渲染 2× 后由浏览器下采样到 CSS 尺寸 → 反走样消除摩尔纹。
    const dpr = size <= 320 ? 2 : Math.min(window.devicePixelRatio || 1, 1.5);
    const planetR = (REF_PLANET_R / REF_CANVAS) * size;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    // 尺寸提到闭包外：既解决 TS 空值收窄，也避免每帧属性访问
    const W = canvas.width;
    const H = canvas.height;

    const center = () => ({ x: W / 2, y: H / 2, r: planetR * dpr });

    function ringPoint(
      c: { x: number; y: number; r: number },
      orb: (typeof ORBITS)[number],
      t: number,
    ) {
      const rx = orb.rx * c.r;
      const ry = orb.ry * c.r;
      const lx = rx * Math.cos(t);
      const ly = ry * Math.sin(t);
      const cos = Math.cos(orb.tilt);
      const sin = Math.sin(orb.tilt);
      return { x: c.x + lx * cos - ly * sin, y: c.y + lx * sin + ly * cos };
    }

    function drawRing(c: { x: number; y: number; r: number }, orb: (typeof ORBITS)[number], front: boolean) {
      ctx!.save();
      const steps = 60;
      ctx!.strokeStyle = RING;
      ctx!.lineWidth = 1 * dpr;
      ctx!.beginPath();
      let started = false;
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        const depth = Math.sin(t);
        if (front ? depth < 0 : depth >= 0) continue; // 前后半段分开，星球才能遮挡后半
        const p = ringPoint(c, orb, t);
        if (!started) {
          ctx!.moveTo(p.x, p.y);
          started = true;
        } else ctx!.lineTo(p.x, p.y);
      }
      ctx!.stroke();
      ctx!.restore();
    }

    function drawSatellite(
      c: { x: number; y: number; r: number },
      orb: (typeof ORBITS)[number],
      sat: SatNote,
    ) {
      const depth = Math.sin(sat.phase);
      const head = ringPoint(c, orb, sat.phase);
      const headR = sat.size * dpr;
      const selected = activeNoteId === sat.id;
      headPosRef.current.push({ id: sat.id, x: head.x, y: head.y, r: headR });

      const baseAlpha = 0.35 + 0.65 * ((depth + 1) / 2);
      const rgb = selected ? [255, 107, 53] : INK;

      // 墨色渐隐拖尾（9 段）
      ctx!.save();
      for (let s = 0; s < TRAIL_SEGS; s++) {
        const t0 = sat.phase - ((s + 1) / TRAIL_SEGS) * TRAIL_RAD;
        const t1 = sat.phase - (s / TRAIL_SEGS) * TRAIL_RAD;
        const p0 = ringPoint(c, orb, t0);
        const p1 = ringPoint(c, orb, t1);
        const segAlpha = (1 - s / TRAIL_SEGS) * baseAlpha * 0.4;
        ctx!.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${segAlpha})`;
        ctx!.lineWidth = Math.max(0.5, headR * (1 - s / TRAIL_SEGS) * 0.8);
        ctx!.beginPath();
        ctx!.moveTo(p0.x, p0.y);
        ctx!.lineTo(p1.x, p1.y);
        ctx!.stroke();
      }
      ctx!.restore();

      // 本体（无发光：裁决 4 禁发光/粒子）
      ctx!.beginPath();
      ctx!.arc(head.x, head.y, headR, 0, Math.PI * 2);
      ctx!.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${baseAlpha})`;
      ctx!.fill();
      if (selected) {
        ctx!.strokeStyle = `rgba(255,107,53,${baseAlpha})`;
        ctx!.lineWidth = 1.5 * dpr;
        ctx!.stroke();
      }
    }

    function drawPlanetBody(c: { x: number; y: number; r: number }, rotation: number) {
      ctx!.save();
      ctx!.beginPath();
      ctx!.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx!.clip();

      ctx!.fillStyle = "#ffffff";
      ctx!.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);

      const seamless = seamlessTexture;
      if (seamless) {
        const scale = (c.r * 2) / seamless.height;
        const period = seamless.width * scale;
        const offset = ((rotation % period) + period) % period;
        const startX = c.x - c.r - offset;
        for (let i = 0; i < 3; i++) {
          ctx!.drawImage(seamless, startX + i * period, c.y - c.r, period, c.r * 2);
        }
      }

      const grad = ctx!.createRadialGradient(c.x, c.y - c.r * 0.15, c.r * 0.25, c.x, c.y, c.r);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.55, "rgba(255,255,255,0)");
      grad.addColorStop(0.85, "rgba(150,150,150,0.18)");
      grad.addColorStop(1, "rgba(120,120,120,0.32)");
      ctx!.fillStyle = grad;
      ctx!.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);

      const topLight = ctx!.createRadialGradient(
        c.x - c.r * 0.4,
        c.y - c.r * 0.5,
        c.r * 0.1,
        c.x - c.r * 0.4,
        c.y - c.r * 0.5,
        c.r * 0.9,
      );
      topLight.addColorStop(0, "rgba(255,255,255,0.18)");
      topLight.addColorStop(1, "rgba(255,255,255,0)");
      ctx!.fillStyle = topLight;
      ctx!.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);

      ctx!.restore();

      // 外圆细描边（1.5px：裁决 4 白空间线稿）
      ctx!.beginPath();
      ctx!.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx!.strokeStyle = PLANET_EDGE;
      ctx!.lineWidth = 1.5 * dpr;
      ctx!.stroke();
    }

    /** mastery 弧：橙色仅此一处 + 选中态（裁决 4） */
    function drawMasteryArc(c: { x: number; y: number; r: number }, mastery: number) {
      if (!(mastery > 0)) return;
      const rr = c.r + 10 * dpr;
      const start = -Math.PI / 2;
      const end = start + Math.PI * 2 * Math.min(1, mastery);
      ctx!.save();
      ctx!.strokeStyle = "rgba(150,150,150,0.22)";
      ctx!.lineWidth = 3 * dpr;
      ctx!.beginPath();
      ctx!.arc(c.x, c.y, rr, 0, Math.PI * 2);
      ctx!.stroke();
      ctx!.strokeStyle = BRAND;
      ctx!.lineCap = "round";
      ctx!.lineWidth = 3 * dpr;
      ctx!.beginPath();
      ctx!.arc(c.x, c.y, rr, start, end);
      ctx!.stroke();
      ctx!.restore();
    }

    /** 卫星溢出聚合「…+N」（契约：上限 16，超出聚合） */
    function drawOverflow(
      c: { x: number; y: number; r: number },
      n: number,
      orb: { rx: number; ry: number; tilt: number } = ORBITS[ORBITS.length - 1],
    ) {
      if (n <= 0) return;
      // P1-9-P1：轨道收敛后，溢出标记改画在**最后一条已绘制**的轨道上（调用方传入），
      // 避免出现在未绘制的环位置。
      const p = ringPoint(c, orb, Math.PI * 1.25);
      ctx!.save();
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, 6 * dpr, 0, Math.PI * 2);
      ctx!.fillStyle = "rgba(255,255,255,0.9)";
      ctx!.fill();
      ctx!.strokeStyle = "rgba(150,150,150,0.6)";
      ctx!.lineWidth = 1 * dpr;
      ctx!.stroke();
      ctx!.fillStyle = INK_HEX;
      ctx!.font = `${9 * dpr}px ui-sans-serif, system-ui, sans-serif`;
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";
      ctx!.fillText(`+${n}`, p.x, p.y + 0.5 * dpr);
      ctx!.restore();
    }

    function drawFrame(rotation: number) {
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.clearRect(0, 0, W, H);
      const c = center();
      headPosRef.current = [];

      // P1-9-P1：轨道数收敛到「卫星数」——0 卫星不画空轨道，1 卫星 1 条，≥2 卫星 2 条。
      // 卫星的 orbit 索引由 derivePlanets 按 ORBITS.length 取模得到（不改），
      // 这里按已绘制轨道数再取模，保证每颗卫星都落在一条被绘制的环上。
      const drawn = ORBITS.slice(0, orbitCountFor(satsRef.current.length));
      const orbOf = (sat: SatNote) =>
        drawn.length ? drawn[sat.orbit % drawn.length] : ORBITS[0];

      drawn.forEach((orb) => drawRing(c, orb, false));
      satsRef.current.forEach((sat) => {
        if (Math.sin(sat.phase) < 0) drawSatellite(c, orbOf(sat), sat);
      });

      drawPlanetBody(c, rotation);
      if (planet?.mastery != null) drawMasteryArc(c, planet.mastery);
      if (planet) drawOverflow(c, planet.overflow, drawn[drawn.length - 1]);

      drawn.forEach((orb) => drawRing(c, orb, true));
      satsRef.current.forEach((sat) => {
        if (Math.sin(sat.phase) >= 0) drawSatellite(c, orbOf(sat), sat);
      });
    }

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced || !animate) {
      // 静态帧：右栏形态 / reduced-motion。卫星不转，仅周期性重绘以纳入迟到数据
      drawFrame(0);
      const iv = window.setInterval(() => drawFrame(0), 1000);
      return () => window.clearInterval(iv);
    }

    let rotation = 0;
    let lastFrame = 0;
    let lastT = 0;
    let running = true;
    let raf = 0;

    function loop(now: number) {
      if (!running) return;
      if (now - lastFrame >= FRAME_MS) {
        const dt = Math.min(100, now - (lastT || now));
        lastT = now;
        lastFrame = now;
        rotation += 0.085 * (dt / 16.67);
        satsRef.current.forEach((sat) => {
          sat.phase = (sat.phase + sat.speed * (dt / 1000)) % (Math.PI * 2);
        });
        drawFrame(rotation);
      }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    // 离屏/隐藏暂停（契约）
    const io = new IntersectionObserver((entries) => {
      const visible = entries[0]?.isIntersecting ?? true;
      if (visible && !running) {
        running = true;
        lastT = 0;
        raf = requestAnimationFrame(loop);
      }
      running = visible;
    });
    io.observe(canvas);
    const onVis = () => {
      if (document.hidden) running = false;
      else if (!running) {
        running = true;
        lastT = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [size, animate, planet, activeNoteId, textureReady]);

  function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!onSatelliteClick) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top) * scale;
    const hit = headPosRef.current.find((h) => (x - h.x) ** 2 + (y - h.y) ** 2 <= (h.r * 2.2) ** 2);
    if (hit) onSatelliteClick(hit.id);
  }

  const label = planet
    ? `知识星系：星球「${planet.title}」，卫星 ${planet.sats.length} 颗` +
      (planet.overflow ? `（另有 ${planet.overflow} 颗未显示）` : "")
    : "知识星系：暂无数据";

  return (
    <canvas
      ref={canvasRef}
      onClick={onCanvasClick}
      style={{ width: size, height: size }}
      aria-label={label}
      role="img"
    />
  );
}

// ---------------------------------------------------------------- 视图层

const TOUR_MS = 4000;

/** 全屏巡览形态：每 4s 轮换下一颗星球，可暂停、可手动点选（点选后停巡览）。 */
export function GalaxyView() {
  const { planets, loading, error } = useGalaxy();
  const [cursor, setCursor] = useState(0);
  const [paused, setPaused] = useState(false);
  const onSatelliteClick = useGalaxyOpenNote();
  const setActiveView = useUi((s) => s.setActiveView);

  useEffect(() => {
    if (planets.length <= 1 || paused) return;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return; // 契约：reduced-motion 下不自动巡览
    const iv = window.setInterval(() => {
      setCursor((c) => (c + 1) % planets.length);
    }, TOUR_MS);
    return () => window.clearInterval(iv);
  }, [planets.length, paused]);

  const idx = planets.length ? cursor % planets.length : 0;
  const planet = planets[idx] ?? null;

  if (loading)
    return (
      <div className="galaxy-view">
        <h1 className="sr-only">知识星系</h1>
        {/* 骨架形状对齐真实视图：560 星球 + 标题条 + eyebrow 条。
            尺寸取自下方 <GalaxyCanvas size={560}>，故 chunk/数据到达后零位移
            （CLS 铁律：GalaxyMini 0.0454→0.0003 的教训）。 */}
        <span className="sr-only">加载星系…</span>
        <Skeleton variant="circle" width={560} height={560} />
        <Skeleton height={18} width={220} />
        <Skeleton height={12} width={150} />
      </div>
    );
  if (error)
    return (
      <div className="galaxy-view">
        <h1 className="sr-only">知识星系</h1>
        <span className="galaxy-caption__title">星系加载失败：{error}</span>
      </div>
    );
  if (!planet)
    return (
      <div className="galaxy-view">
        <h1 className="sr-only">知识星系</h1>
        <span className="galaxy-caption__title">还没有笔记——回工作区写第一篇</span>
        <span className="galaxy-caption__eyebrow">星球由 [[双链]] 生长：链出去 ≥2 篇的笔记会成为星球</span>
        {/* 空态唯一出口（ui/empty-states.html ⑤ 门禁 2「卡内 button 数 = 1」）。
            这是 Button 在本项目的第一个业务落点；此前之所以 0 接线，正是因为
            .btn-primary 的渐变会违反 ADR-013 §2.13 line 291，现已改为纯色实底。 */}
        <Button variant="primary" onClick={() => setActiveView("notes")}>
          回工作区写第一篇
        </Button>
      </div>
    );

  return (
    <div className="galaxy-view">
      <h1 className="sr-only">知识星系</h1>
      <GalaxyCanvas
        size={560}
        planet={planet}
        animate
        onSatelliteClick={(id) => {
          setPaused(true); // 点选后停巡览
          onSatelliteClick(id);
        }}
      />
      <div className="galaxy-caption">
        <span className="galaxy-caption__eyebrow">
          星球 {idx + 1}/{planets.length} · 卫星 {planet.sats.length}
          {planet.overflow ? ` (+${planet.overflow})` : ""}
          {planet.mastery != null ? ` · 掌握度 ${Math.round(planet.mastery * 100)}%` : ""}
        </span>
        <span className="galaxy-caption__title">{planet.title}</span>
      </div>

      {planets.length > 1 && (
        <div className="galaxy-tour">
          <button
            type="button"
            className="galaxy-tour__btn"
            onClick={() => setPaused((p) => !p)}
            aria-pressed={paused}
          >
            {paused ? "继续巡览" : "暂停巡览"}
          </button>
          <div className="galaxy-tour__dots" role="tablist" aria-label="选择星球">
            {planets.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={i === idx}
                aria-label={p.title}
                className={`galaxy-tour__dot${i === idx ? " is-active" : ""}`}
                onClick={() => {
                  setPaused(true); // 手动点选后停巡览
                  setCursor(i);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** 点卫星 → 打开该笔记（跨视图跳转，与图谱节点行为一致）。 */
function useGalaxyOpenNote() {
  const openNote = useUi((s) => s.openNote);
  return useCallback((id: number) => openNote(id), [openNote]);
}

/**
 * 右栏常驻迷你星系（spec §3.3 右栏单颗形态）。
 * 显示当前笔记所属的星球：若该笔记本身是星球则显示它，否则显示它作为卫星归属的星球。
 * **卫星静止不转**——右栏服务于阅读，余光里不该有东西动。
 */
export function GalaxyMini({ activeNoteId }: { activeNoteId: number | null }) {
  const { planets } = useGalaxy();
  const onSatelliteClick = useGalaxyOpenNote();

  const planet = useMemo(() => {
    if (!planets.length) return null;
    if (activeNoteId === null) return planets[0];
    const own = planets.find((p) => p.id === activeNoteId);
    if (own) return own;
    const host = planets.find((p) => p.sats.some((s) => s.id === activeNoteId));
    return host ?? planets[0];
  }, [planets, activeNoteId]);

  // 注意：数据未到时**不要** return null——会造成 CLS
  // （空态 0px → 数据到位 272px，实测把右栏下推 317px，CLS 0.045）。
  // 始终渲染容器、预留固定高度，数据以淡入方式填入。
  return (
    <div className="ctx-galaxy">
      <GalaxyCanvas
        size={GALAXY_MINI_SIZE}
        planet={planet}
        animate
        activeNoteId={activeNoteId}
        onSatelliteClick={onSatelliteClick}
      />
      <span className="ctx-galaxy__hint">
        {planet
          ? `${planet.title} · 卫星 ${planet.sats.length}${planet.overflow ? ` (+${planet.overflow})` : ""}`
          : "知识星系"}
      </span>
    </div>
  );
}
