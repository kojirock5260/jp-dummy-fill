import { describe, expect, it } from "vitest";
import { CENTERS, findAddress, ISLANDS } from "../../src/domain/data/addresses";
import { PLACE_GROUPS } from "../../src/domain/places";

describe("PLACE_GROUPS", () => {
  const region = PLACE_GROUPS.find((g) => g.id === "region");
  const island = PLACE_GROUPS.find((g) => g.id === "island");

  it("lists Hokkaido, Kyushu and Okinawa main island as the regions with their own rate", () => {
    expect(region?.items.map((p) => p.label)).toEqual([
      "北海道（札幌市中央区）",
      "九州（福岡県福岡市博多区）",
      "沖縄本島（沖縄県那覇市）",
    ]);
    for (const p of region?.items ?? []) {
      expect(
        CENTERS.some((c) => c.zip === p.zip),
        p.zip,
      ).toBe(true);
    }
  });

  it("lists every island under its common name", () => {
    expect(island?.items).toHaveLength(ISLANDS.length);
    expect(island?.items.map((p) => p.zip)).toEqual(ISLANDS.map((a) => a.zip));
    expect(island?.items.find((p) => p.zip === "952-1209")?.label).toBe("佐渡島（新潟県佐渡市）");
    expect(island?.items.find((p) => p.zip === "998-0281")?.label).toBe("飛島（山形県酒田市）");
  });

  it("can be filtered by the common reading and by the city reading", () => {
    const sado = island?.items.find((p) => p.zip === "952-1209");
    expect(sado?.aliases).toContain("サドガシマ");
    expect(sado?.aliases).toContain("サドシ");
    const kyushu = region?.items.find((p) => p.zip === "812-0045");
    expect(kyushu?.aliases).toContain("キュウシュウ");
    expect(kyushu?.aliases).toContain("フクオカケン");
  });

  it("points every row at a real address and never repeats one", () => {
    const zips = PLACE_GROUPS.flatMap((g) => g.items.map((p) => p.zip));
    expect(new Set(zips).size).toBe(zips.length);
    for (const zip of zips) {
      expect(findAddress(zip), zip).toBeDefined();
    }
  });
});
