import { describe, expect, it } from "vitest";
import { SEED_EPOCH, seedAt } from "../../src/domain/seed";

describe("seedAt", () => {
  it("counts minutes from the epoch", () => {
    expect(seedAt(new Date(SEED_EPOCH))).toBe(0);
    expect(seedAt(new Date(SEED_EPOCH + 60_000))).toBe(1);
    expect(seedAt(new Date(SEED_EPOCH + 90_000))).toBe(1);
    expect(seedAt(new Date(SEED_EPOCH + 24 * 60 * 60_000))).toBe(1440);
  });

  it("gives the same number within a minute and a new one the next minute", () => {
    const t = SEED_EPOCH + 5_000_000 * 60_000;
    expect(seedAt(new Date(t + 10_000))).toBe(seedAt(new Date(t + 50_000)));
    expect(seedAt(new Date(t + 60_000))).toBe(seedAt(new Date(t)) + 1);
  });

  it("never goes below zero, even before the epoch", () => {
    expect(seedAt(new Date(SEED_EPOCH - 1))).toBe(0);
    expect(seedAt(new Date(2000, 0, 1))).toBe(0);
  });

  it("stays a readable number for years", () => {
    // 2036 年でも 7 桁。メールアドレスから読み取って打ち直せる長さ。
    expect(seedAt(new Date(Date.UTC(2036, 0, 1)))).toBeLessThan(10_000_000);
  });
});
