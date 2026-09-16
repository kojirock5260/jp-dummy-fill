import { describe, expect, it } from "vitest";
import { CENTERS, ISLANDS } from "../../src/domain/data/addresses";
import {
  ageAt,
  checkDigit,
  generate,
  landlineOf,
  mobileOf,
  PASSWORD,
  pickAddress,
} from "../../src/domain/person";
import { createRandom } from "../../src/domain/random";

/** 年齢を固定するための基準日。 */
const TODAY = new Date(2026, 8, 5);

describe("generate", () => {
  it("gives the same person for the same seed", () => {
    expect(generate(0, {}, TODAY)).toEqual(generate(0, {}, TODAY));
    expect(generate(12, {}, TODAY)).toEqual(generate(12, {}, TODAY));
  });

  it("gives a different person for the next seed", () => {
    const a = generate(0, {}, TODAY);
    const b = generate(1, {}, TODAY);
    expect(`${a.family}${a.given}`).not.toBe(`${b.family}${b.given}`);
    expect(a.address.pref).not.toBe(b.address.pref);
  });

  it("keeps seed 0 fixed", () => {
    // 変えるときは意図して変えること。README の例や手動確認の期待値がこれに依っている。
    expect(generate(0, {}, TODAY)).toMatchInlineSnapshot(`
      {
        "address": {
          "areaCode": "03",
          "city": "千代田区",
          "cityKana": "チヨダク",
          "kind": "center",
          "note": "官庁街",
          "pref": "東京都",
          "prefCode": 13,
          "prefKana": "トウキョウト",
          "town": "霞が関",
          "townKana": "カスミガセキ",
          "zip": "100-0013",
          "zone": [
            "main",
          ],
        },
        "age": 42,
        "birth": {
          "d": 18,
          "m": 7,
          "y": 1984,
        },
        "block": "4-10-12",
        "building": "霞が関ビル 301",
        "buildingName": "霞が関ビル",
        "card": {
          "brand": "visa",
          "cvc": "123",
          "expMonth": 12,
          "expYear": 2029,
          "number": "4242424242424242",
        },
        "company": "阿部商事株式会社",
        "companyKana": "あべしょうじ",
        "corporateNumber": "3543075213232",
        "department": "営業部",
        "email": "shou.abe.0@example.jp",
        "family": "阿部",
        "familyKana": "あべ",
        "familyRomaji": "abe",
        "given": "翔",
        "givenKana": "しょう",
        "givenRomaji": "shou",
        "invoiceNumber": "T3543075213232",
        "landline": "03-1128-3079",
        "mobile": "090-0947-6865",
        "password": "Dummy!Pass01",
        "room": "301",
        "seed": 0,
        "sex": "male",
        "title": "課長",
        "url": "https://example.jp/",
        "username": "abe_shou_0",
      }
    `);
  });

  it("puts seed 0 in 霞が関 and walks the 47 centers from there", () => {
    expect(generate(0, {}, TODAY).address.town).toBe("霞が関");
    const prefs = Array.from({ length: 47 }, (_, s) => generate(s, {}, TODAY).address.pref);
    expect(new Set(prefs).size).toBe(47);
    expect(generate(47, {}, TODAY).address.pref).toBe("東京都");
  });

  it("keeps everyone between 20 and 65 years old", () => {
    for (let s = 0; s < 200; s++) {
      const p = generate(s, {}, TODAY);
      expect(p.age, `seed ${s}`).toBeGreaterThanOrEqual(20);
      expect(p.age, `seed ${s}`).toBeLessThanOrEqual(65);
      expect(ageAt(p.birth, TODAY)).toBe(p.age);
    }
  });

  it("matches the given name to the sex", async () => {
    const { GIVEN_FEMALE, GIVEN_MALE } = await import("../../src/domain/data/names");
    for (let s = 0; s < 50; s++) {
      const p = generate(s, {}, TODAY);
      const pool = p.sex === "male" ? GIVEN_MALE : GIVEN_FEMALE;
      expect(
        pool.map(([k]) => k),
        `seed ${s}`,
      ).toContain(p.given);
    }
  });

  it("builds email and username from the readings", () => {
    const p = generate(0, {}, TODAY);
    expect(p.email).toMatch(/^[a-z]+\.[a-z]+\.0@example\.jp$/);
    expect(p.username).toMatch(/^[a-z]+_[a-z]+_0$/);
    // 同じ姓名でも seed が違えば衝突しない。
    expect(generate(47, {}, TODAY).email).not.toBe(
      generate(0, {}, TODAY).email.replace(".0@", ".47@").replace(".47@", ".0@"),
    );
  });

  it("uses the fixed password", () => {
    expect(generate(3, {}, TODAY).password).toBe(PASSWORD);
    expect(PASSWORD).toMatch(/[A-Z]/);
    expect(PASSWORD).toMatch(/[a-z]/);
    expect(PASSWORD).toMatch(/\d/);
    expect(PASSWORD).toMatch(/[^A-Za-z0-9]/);
    expect(PASSWORD).toHaveLength(12);
  });

  it("makes numbers that cannot exist", () => {
    for (let s = 0; s < 50; s++) {
      const p = generate(s, {}, TODAY);
      expect(p.mobile, `seed ${s}`).toMatch(/^090-0\d{3}-\d{4}$/);
      // 市外局番 + 市内局番 + 加入者番号 で 10 桁。市内局番は 1 で始まる。
      const [area, local, last] = p.landline.split("-");
      expect(area).toBe(p.address.areaCode);
      expect(local).toMatch(/^1\d*$/);
      expect(last).toMatch(/^\d{4}$/);
      expect((area + local + last).length).toBe(10);
    }
  });

  it("names the company after the family", () => {
    const p = generate(0, {}, TODAY);
    expect(p.company).toBe(`${p.family}商事株式会社`);
    expect(p.companyKana).toBe(`${p.familyKana}しょうじ`);
    expect(p.building).toMatch(new RegExp(`^${p.address.town}ビル \\d0\\d$`));
  });

  it("keeps the person when only the address changes", () => {
    const base = generate(0, {}, TODAY);
    const sado = generate(0, { place: { kind: "at", zip: "952-1209" } }, TODAY);
    const naha = generate(0, { place: { kind: "at", zip: "900-0021" } }, TODAY);
    for (const p of [sado, naha]) {
      expect(p.family).toBe(base.family);
      expect(p.given).toBe(base.given);
      expect(p.birth).toEqual(base.birth);
      expect(p.mobile).toBe(base.mobile);
      expect(p.email).toBe(base.email);
    }
    expect(sado.address.kind).toBe("island");
    expect(sado.address.pref).toBe("新潟県");
    expect(naha.address.kind).toBe("center");
    expect(naha.address.pref).toBe("沖縄県");
    // 固定電話は住所に付いていくので変わる。
    expect(sado.landline.startsWith(sado.address.areaCode)).toBe(true);
    expect(sado.landline).not.toBe(base.landline);
  });
});

describe("pickAddress", () => {
  it("returns the chosen row for `at`, whatever the seed or the selected prefecture", () => {
    const at = { kind: "at" as const, zip: "907-0012" };
    expect(pickAddress(0, { place: at }).city).toBe("石垣市");
    expect(pickAddress(30, { pref: "大阪府", place: at })).toEqual(
      ISLANDS.find((a) => a.zip === "907-0012"),
    );
  });

  it("falls back to the center when the zip is unknown", () => {
    const at = { kind: "at" as const, zip: "000-0000" };
    expect(pickAddress(0, { place: at }).town).toBe("霞が関");
    expect(pickAddress(0, { pref: "大阪府", place: at }).city).toBe("大阪市中央区");
  });

  it("uses the selected prefecture instead of the seed", () => {
    expect(pickAddress(0, { pref: "大阪府" }).city).toBe("大阪市中央区");
    expect(pickAddress(30, { pref: "大阪府" }).city).toBe("大阪市中央区");
  });

  it("ignores an unknown prefecture", () => {
    expect(pickAddress(0, { pref: "江戸" })).toEqual(CENTERS.find((a) => a.pref === "東京都"));
  });

  it("wraps negative seeds", () => {
    expect(pickAddress(-47, {}).pref).toBe("東京都");
  });
});

describe("landlineOf / mobileOf", () => {
  it("shapes the landline by the area code length", () => {
    expect(landlineOf("03", createRandom(1))).toMatch(/^03-1\d{3}-\d{4}$/);
    expect(landlineOf("045", createRandom(1))).toMatch(/^045-1\d{2}-\d{4}$/);
    expect(landlineOf("0776", createRandom(1))).toMatch(/^0776-1\d-\d{4}$/);
    expect(landlineOf("04998", createRandom(1))).toMatch(/^04998-1-\d{4}$/);
  });

  it("keeps mobiles in the unassigned 090-0 band", () => {
    for (let s = 0; s < 20; s++) {
      expect(mobileOf(createRandom(s))).toMatch(/^090-0\d{3}-\d{4}$/);
    }
  });
});

describe("ageAt", () => {
  it("counts a birthday that has passed this year", () => {
    expect(ageAt({ y: 2000, m: 1, d: 1 }, new Date(2026, 8, 5))).toBe(26);
  });

  it("does not count a birthday still to come", () => {
    expect(ageAt({ y: 2000, m: 12, d: 31 }, new Date(2026, 8, 5))).toBe(25);
  });

  it("counts the birthday itself", () => {
    expect(ageAt({ y: 2000, m: 9, d: 5 }, new Date(2026, 8, 5))).toBe(26);
  });
});

describe("corporate number and card", () => {
  it("passes the National Tax Agency check digit", () => {
    // 公開されている法人番号の例（トヨタ自動車 1180301018771）で検査式を確かめる。
    expect(checkDigit("180301018771")).toBe(1);
    for (const seed of [0, 1, 42, 357635]) {
      const p = generate(seed, {}, TODAY);
      expect(p.corporateNumber).toMatch(/^\d{13}$/);
      expect(Number(p.corporateNumber[0])).toBe(checkDigit(p.corporateNumber.slice(1)));
      expect(p.invoiceNumber).toBe(`T${p.corporateNumber}`);
    }
  });

  it("keeps the 0.1.0 values of seed 0 in front of the new draws", () => {
    const p = generate(0, {}, TODAY);
    expect(p.email).toBe("shou.abe.0@example.jp");
    expect(p.landline).toBe("03-1128-3079");
    expect(p.familyRomaji).toBe("abe");
    expect(p.givenRomaji).toBe("shou");
  });

  it("uses Stripe's Visa test card, expiring in December three years ahead", () => {
    expect(generate(0, {}, TODAY).card).toEqual({
      number: "4242424242424242",
      brand: "visa",
      expMonth: 12,
      expYear: 2029,
      cvc: "123",
    });
  });
});
