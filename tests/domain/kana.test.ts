import { describe, expect, it } from "vitest";
import {
  hiraToKata,
  kataToHira,
  toFullWidthDigits,
  toHalfWidth,
  toHalfWidthKana,
  toRomaji,
} from "../../src/domain/kana";

describe("hiraToKata / kataToHira", () => {
  it("converts hiragana to katakana", () => {
    expect(hiraToKata("やまだ たろう")).toBe("ヤマダ タロウ");
    expect(hiraToKata("ゔ")).toBe("ヴ");
  });

  it("converts katakana to hiragana", () => {
    expect(kataToHira("ヤマダ タロウ")).toBe("やまだ たろう");
  });

  it("round-trips", () => {
    const s = "さとう はなこ";
    expect(kataToHira(hiraToKata(s))).toBe(s);
  });

  it("leaves non-kana alone, including the long vowel mark and digits", () => {
    expect(hiraToKata("キタ3ジョウニシ 1-2-3")).toBe("キタ3ジョウニシ 1-2-3");
    expect(kataToHira("トウキョウ・ー")).toBe("とうきょう・ー");
  });
});

describe("toHalfWidthKana", () => {
  it("converts plain katakana", () => {
    expect(toHalfWidthKana("ヤマダ")).toBe("ﾔﾏﾀﾞ");
  });

  it("splits voiced marks into a separate code point", () => {
    expect(toHalfWidthKana("ガギグ")).toBe("ｶﾞｷﾞｸﾞ");
    expect(toHalfWidthKana("パピプ")).toBe("ﾊﾟﾋﾟﾌﾟ");
  });

  it("accepts hiragana input", () => {
    expect(toHalfWidthKana("たろう")).toBe("ﾀﾛｳ");
  });

  it("converts the long vowel mark and the full-width space", () => {
    expect(toHalfWidthKana("スーパー　マン")).toBe("ｽｰﾊﾟｰ ﾏﾝ");
  });

  it("leaves digits and hyphens alone", () => {
    expect(toHalfWidthKana("チヨダ1-2-3")).toBe("ﾁﾖﾀﾞ1-2-3");
  });
});

describe("toFullWidthDigits", () => {
  it("widens digits and hyphens", () => {
    expect(toFullWidthDigits("100-0013")).toBe("１００－００１３");
    expect(toFullWidthDigits("1-2-3")).toBe("１－２－３");
  });

  it("uses a hyphen that NFKC folds back to ASCII", () => {
    expect(toFullWidthDigits("1-2").normalize("NFKC")).toBe("1-2");
  });

  it("leaves other characters alone", () => {
    expect(toFullWidthDigits("千代田1-2-3")).toBe("千代田１－２－３");
  });
});

describe("toHalfWidth", () => {
  it("narrows full-width letters, digits and symbols", () => {
    expect(toHalfWidth("ＡＢＣ１２３－＠")).toBe("ABC123-@");
  });

  it("turns the full-width space into a plain space", () => {
    expect(toHalfWidth("山田　太郎")).toBe("山田 太郎");
  });

  it("does not touch kana", () => {
    expect(toHalfWidth("ヤマダ")).toBe("ヤマダ");
  });
});

describe("toRomaji", () => {
  it("converts plain syllables", () => {
    expect(toRomaji("やまだ")).toBe("yamada");
    expect(toRomaji("たろう")).toBe("tarou");
    expect(toRomaji("さとう")).toBe("satou");
  });

  it("uses Hepburn spellings for shi, chi, tsu, fu and ji", () => {
    expect(toRomaji("しみず")).toBe("shimizu");
    expect(toRomaji("ちば")).toBe("chiba");
    expect(toRomaji("つちや")).toBe("tsuchiya");
    expect(toRomaji("ふじた")).toBe("fujita");
  });

  it("handles contracted sounds", () => {
    expect(toRomaji("きょうこ")).toBe("kyouko");
    expect(toRomaji("しょうじ")).toBe("shouji");
    expect(toRomaji("じゅんこ")).toBe("junko");
    expect(toRomaji("りょう")).toBe("ryou");
  });

  it("doubles the consonant after っ, and writes tch before ch", () => {
    expect(toRomaji("はっとり")).toBe("hattori");
    expect(toRomaji("まっちゃ")).toBe("matcha");
    expect(toRomaji("いっせい")).toBe("issei");
  });

  it("drops a っ that has nothing to double", () => {
    expect(toRomaji("あっ")).toBe("a");
    expect(toRomaji("あっい")).toBe("ai");
  });

  it("accepts katakana too", () => {
    expect(toRomaji("タロウ")).toBe("tarou");
  });

  it("keeps characters it does not know", () => {
    expect(toRomaji("山田")).toBe("山田");
  });

  it("gives every family name in the data a plain ASCII spelling", async () => {
    const { FAMILY } = await import("../../src/domain/data/names");
    for (const [, kana] of FAMILY) {
      expect(toRomaji(kana), kana).toMatch(/^[a-z]+$/);
    }
  });
});
