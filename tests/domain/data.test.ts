import { describe, expect, it } from "vitest";
import {
  ADDRESSES,
  CENTERS,
  findAddress,
  ISLANDS,
  PREFECTURES,
  parsePrefecture,
  shortPref,
} from "../../src/domain/data/addresses";
import { FAMILY, GIVEN_FEMALE, GIVEN_MALE } from "../../src/domain/data/names";

/**
 * データの形を固定する。
 *
 * `addresses.json` は生成物なので、作り直したときに件数や文字種が崩れていないかを
 * ここで見る。「全件まだ存在するか」は `npm run data:check` の仕事で、日本郵便の
 * データを引くのでテストには入れていない。
 */

describe("addresses", () => {
  it("has 65 rows: 47 centers and 18 islands", () => {
    expect(ADDRESSES).toHaveLength(65);
    expect(CENTERS).toHaveLength(47);
    expect(ISLANDS).toHaveLength(18);
  });

  it("has one center per prefecture, in code order", () => {
    expect(CENTERS.map((a) => a.prefCode)).toEqual(Array.from({ length: 47 }, (_, i) => i + 1));
    expect(new Set(CENTERS.map((a) => a.pref)).size).toBe(47);
  });

  it("names every island, with a katakana reading, in prefecture code order", () => {
    for (const a of ISLANDS) {
      expect(a.name, a.zip).toBeTruthy();
      expect(a.nameKana, a.zip).toMatch(/^[ァ-ヶー]+$/);
      expect(a.zone, a.zip).toContain("island");
    }
    const codes = ISLANDS.map((a) => a.prefCode);
    expect(codes).toEqual([...codes].sort((x, y) => x - y));
    for (const a of CENTERS) {
      expect(a.name, a.zip).toBeUndefined();
    }
  });

  it("finds a row by zip", () => {
    expect(findAddress("952-1209")?.city).toBe("佐渡市");
    expect(findAddress("100-0013")?.town).toBe("霞が関");
    expect(findAddress("000-0000")).toBeUndefined();
  });

  it("starts seed 0 at 霞が関", () => {
    const tokyo = CENTERS.find((a) => a.pref === "東京都");
    expect(tokyo?.town).toBe("霞が関");
    expect(tokyo?.zip).toBe("100-0013");
  });

  it("formats every zip as 3-4 digits and every area code with a leading zero", () => {
    for (const a of ADDRESSES) {
      expect(a.zip, a.zip).toMatch(/^\d{3}-\d{4}$/);
      expect(a.areaCode, a.zip).toMatch(/^0\d{1,4}$/);
    }
  });

  it("writes readings in full-width katakana with half-width digits", () => {
    for (const a of ADDRESSES) {
      for (const kana of [a.prefKana, a.cityKana, a.townKana]) {
        expect(kana, `${a.zip} ${kana}`).toMatch(/^[ァ-ヶー0-9]+$/);
      }
    }
  });

  it("keeps parenthesized notes out of town names", () => {
    for (const a of ADDRESSES) {
      expect(a.town, a.zip).not.toMatch(/[（(]/);
    }
  });

  it("uses only the known zones", () => {
    for (const a of ADDRESSES) {
      for (const z of a.zone) {
        expect(["main", "hokkaido", "okinawa", "island"]).toContain(z);
      }
    }
  });

  it("has no duplicate zips", () => {
    expect(new Set(ADDRESSES.map((a) => a.zip)).size).toBe(ADDRESSES.length);
  });
});

describe("prefectures", () => {
  it("lists 47 with code, name and kana", () => {
    expect(PREFECTURES).toHaveLength(47);
    expect(PREFECTURES[12]).toEqual({ code: 13, name: "東京都", kana: "トウキョウト" });
  });

  it("shortens names except 北海道", () => {
    expect(shortPref("東京都")).toBe("東京");
    expect(shortPref("大阪府")).toBe("大阪");
    expect(shortPref("沖縄県")).toBe("沖縄");
    expect(shortPref("北海道")).toBe("北海道");
  });

  it("parses the name, the short name, the code and the kana", () => {
    for (const text of ["東京都", "東京", "13", "１３", "トウキョウト"]) {
      expect(parsePrefecture(text)?.code, text).toBe(13);
    }
    expect(parsePrefecture("北海道")?.code).toBe(1);
  });

  it("rejects placeholders", () => {
    expect(parsePrefecture("")).toBeNull();
    expect(parsePrefecture("選択してください")).toBeNull();
    expect(parsePrefecture("0")).toBeNull();
  });
});

describe("names", () => {
  it("has 100 family names and 50 given names per sex", () => {
    expect(FAMILY).toHaveLength(100);
    expect(GIVEN_MALE).toHaveLength(50);
    expect(GIVEN_FEMALE).toHaveLength(50);
  });

  it("writes every reading in hiragana", () => {
    for (const [kanji, kana] of [...FAMILY, ...GIVEN_MALE, ...GIVEN_FEMALE]) {
      expect(kana, kanji).toMatch(/^[ぁ-ゖ]+$/);
    }
  });
});
