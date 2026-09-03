import { describe, expect, it } from "vitest";

import { orbitCountFor } from "./GalaxyCanvas";

/**
 * P1-9-P1：渲染层门禁——轨道数量必须由「卫星数」决定，不允许回退成固定 4 圈。
 *
 * 背景：ORBITS 常量是固定 4 条；原先无条件全部绘制，导致 0 卫星的星球也画
 * 4 圈空轨道（P1-9 取证：18 颗星球里 16 颗 0 卫星）。
 */
describe("orbitCountFor（P1-9-P1 空轨道收敛）", () => {
  it("0 卫星 → 0 条轨道（不画空轨道）", () => {
    expect(orbitCountFor(0)).toBe(0);
  });

  it("1 卫星 → 1 条轨道", () => {
    expect(orbitCountFor(1)).toBe(1);
  });

  it("≥2 卫星 → 2 条轨道（封顶，不再恒定 4 圈）", () => {
    for (const n of [2, 3, 4, 8, 16, 17, 40]) {
      expect(orbitCountFor(n)).toBe(2);
    }
  });

  it("不超过 ORBITS 可用轨道数（与常量同步的守卫）", () => {
    // 规则封顶 2；即便 ORBITS 未来扩容，本规则仍应保持 ≤2（视觉降噪的确定性）
    for (const n of [0, 1, 2, 3, 99]) {
      const got = orbitCountFor(n);
      expect(got).toBeGreaterThanOrEqual(0);
      expect(got).toBeLessThanOrEqual(2);
    }
  });

  it("非法输入（负 / NaN）→ 0", () => {
    expect(orbitCountFor(-1)).toBe(0);
    expect(orbitCountFor(Number.NaN)).toBe(0);
  });
});
