import { describe, expect, it } from "vitest";
import { ERAS, fromWareki, parseEra, toWareki } from "../../src/domain/wareki";

describe("toWareki", () => {
  it("puts 2019-05-01 in 令和 1 and the day before in 平成 31", () => {
    expect(toWareki(2019, 5, 1)).toMatchObject({ era: { name: "令和" }, year: 1 });
    expect(toWareki(2019, 4, 30)).toMatchObject({ era: { name: "平成" }, year: 31 });
  });

  it("puts 1989-01-08 in 平成 1 and the day before in 昭和 64", () => {
    expect(toWareki(1989, 1, 8)).toMatchObject({ era: { name: "平成" }, year: 1 });
    expect(toWareki(1989, 1, 7)).toMatchObject({ era: { name: "昭和" }, year: 64 });
  });

  it("puts 1926-12-25 in 昭和 1", () => {
    expect(toWareki(1926, 12, 25)).toMatchObject({ era: { name: "昭和" }, year: 1 });
    expect(toWareki(1926, 12, 24)).toMatchObject({ era: { name: "大正" }, year: 15 });
  });

  it("counts years from the era start", () => {
    expect(toWareki(1990, 5, 14)).toMatchObject({ era: { name: "平成" }, year: 2 });
    expect(toWareki(2024, 1, 1)).toMatchObject({ era: { name: "令和" }, year: 6 });
    expect(toWareki(1975, 6, 1)).toMatchObject({ era: { name: "昭和" }, year: 50 });
  });

  it("returns null before 明治", () => {
    expect(toWareki(1867, 1, 1)).toBeNull();
  });
});

describe("fromWareki", () => {
  it("inverts toWareki", () => {
    for (const [y, m, d] of [
      [1990, 5, 14],
      [2019, 5, 1],
      [1961, 1, 1],
      [2005, 12, 31],
    ]) {
      const w = toWareki(y, m, d);
      expect(w).not.toBeNull();
      if (w) {
        expect(fromWareki(w.era, w.year)).toBe(y);
      }
    }
  });
});

describe("parseEra", () => {
  it("accepts the name, the first character, the initial and the JIS code", () => {
    for (const text of ["平成", "平", "H", "h", "4", "Ｈ"]) {
      expect(parseEra(text)?.name, text).toBe("平成");
    }
    for (const text of ["令和", "R", "5"]) {
      expect(parseEra(text)?.name, text).toBe("令和");
    }
  });

  it("rejects unrelated text", () => {
    expect(parseEra("選択してください")).toBeNull();
    expect(parseEra("")).toBeNull();
  });
});

describe("ERAS", () => {
  it("runs from newest to oldest with unique codes", () => {
    expect(ERAS.map((e) => e.name)).toEqual(["令和", "平成", "昭和", "大正", "明治"]);
    expect(new Set(ERAS.map((e) => e.code)).size).toBe(ERAS.length);
  });
});
