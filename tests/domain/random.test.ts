import { describe, expect, it } from "vitest";
import { createRandom } from "../../src/domain/random";

describe("createRandom", () => {
  it("gives the same sequence for the same seed", () => {
    const a = createRandom(0);
    const b = createRandom(0);
    for (let i = 0; i < 20; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it("gives a different sequence for the next seed", () => {
    const a = createRandom(0);
    const b = createRandom(1);
    const same = Array.from({ length: 10 }, () => a.next() === b.next()).every(Boolean);
    expect(same).toBe(false);
  });

  it("stays in [0, 1)", () => {
    const r = createRandom(42);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("keeps int within the inclusive range and reaches both ends", () => {
    const r = createRandom(7);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = r.int(1, 3);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(3);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it("picks only from the given items", () => {
    const r = createRandom(3);
    const items = ["a", "b", "c"];
    for (let i = 0; i < 100; i++) {
      expect(items).toContain(r.pick(items));
    }
  });
});
