import { describe, expect, it } from "vitest";
import type { Address } from "../../src/domain/data/addresses";
import { type FieldInfo, type FieldKind, fieldInfo } from "../../src/domain/field";
import type { Person } from "../../src/domain/person";
import {
  appendix,
  futureDate,
  kanaScript,
  nameSeparator,
  phonePart,
  pickOption,
  type RenderContext,
  render,
  wantsHyphen,
} from "../../src/domain/render";

/** 手で組んだ人物。generate に依らないので、乱数が変わってもここは変わらない。 */
const ADDRESS: Address = {
  zip: "100-0013",
  prefCode: 13,
  pref: "東京都",
  prefKana: "トウキョウト",
  city: "千代田区",
  cityKana: "チヨダク",
  town: "霞が関",
  townKana: "カスミガセキ",
  kind: "center",
  zone: ["main"],
  areaCode: "03",
  note: "官庁街",
};

const PERSON: Person = {
  seed: 0,
  sex: "male",
  family: "山田",
  given: "太郎",
  familyKana: "やまだ",
  givenKana: "たろう",
  familyRomaji: "yamada",
  givenRomaji: "tarou",
  address: ADDRESS,
  block: "1-2-3",
  building: "霞が関ビル 403",
  buildingName: "霞が関ビル",
  room: "403",
  mobile: "090-0123-4567",
  landline: "03-1234-5678",
  email: "tarou.yamada@example.jp",
  username: "yamada_tarou",
  password: "Dummy!Pass01",
  birth: { y: 1990, m: 5, d: 14 },
  age: 36,
  company: "山田商事株式会社",
  companyKana: "やまだしょうじ",
  department: "営業部",
  title: "課長",
  url: "https://example.jp/",
  corporateNumber: "8123456789012",
  invoiceNumber: "T8123456789012",
  card: { number: "4242424242424242", brand: "visa", expMonth: 12, expYear: 2029, cvc: "123" },
};

const TODAY = new Date(2026, 8, 5);

/**
 * 欄種と欄から値を作る。
 *
 * @param kind 欄種
 * @param over 欄の属性
 * @param kinds form にある他の欄種。省略時は都道府県・市区町村・建物が揃った form
 * @returns 入れる値
 */
function value(
  kind: FieldKind,
  over: Partial<FieldInfo> = {},
  kinds: FieldKind[] = [kind, "prefecture", "city", "town", "building"],
): string | null {
  const ctx: RenderContext = { today: TODAY, kinds: new Set(kinds) };
  return render(kind, PERSON, fieldInfo(over), ctx);
}

const opts = (...texts: string[]) => texts.map((t) => ({ value: t, text: t }));

describe("kanaScript", () => {
  it("defaults to katakana", () => {
    expect(kanaScript(fieldInfo({ name: "kana" }))).toBe("katakana");
  });

  it("follows a katakana word in the label", () => {
    expect(kanaScript(fieldInfo({ label: "フリガナ" }))).toBe("katakana");
    expect(kanaScript(fieldInfo({ placeholder: "セイ" }))).toBe("katakana");
  });

  it("follows a hiragana word in the label", () => {
    expect(kanaScript(fieldInfo({ label: "ふりがな" }))).toBe("hiragana");
    expect(kanaScript(fieldInfo({ label: "お名前（ひらがな）" }))).toBe("hiragana");
  });

  it("lets a katakana word win over a hiragana one, as Chrome does", () => {
    expect(kanaScript(fieldInfo({ label: "フリガナ", placeholder: "やまだ" }))).toBe("katakana");
  });

  it("reads the script off an example in the placeholder", () => {
    expect(kanaScript(fieldInfo({ name: "kana", placeholder: "やまだ たろう" }))).toBe("hiragana");
    expect(kanaScript(fieldInfo({ name: "kana", placeholder: "ヤマダ タロウ" }))).toBe("katakana");
  });

  it("does not let スペースなし force katakana on a hiragana field", () => {
    expect(kanaScript(fieldInfo({ label: "ふりがな（スペースなし）" }))).toBe("hiragana");
  });

  it("falls back to the name when the label says nothing", () => {
    expect(kanaScript(fieldInfo({ name: "furigana" }))).toBe("hiragana");
    expect(kanaScript(fieldInfo({ name: "name_hiragana" }))).toBe("hiragana");
    expect(kanaScript(fieldInfo({ name: "name_katakana" }))).toBe("katakana");
  });

  it("lets the label win over the name", () => {
    expect(kanaScript(fieldInfo({ name: "furigana", label: "フリガナ" }))).toBe("katakana");
  });

  it("reads the pattern last", () => {
    expect(kanaScript(fieldInfo({ name: "x", pattern: "^[ァ-ヶー]+$" }))).toBe("katakana");
    expect(kanaScript(fieldInfo({ name: "x", pattern: "^[ぁ-ん]+$" }))).toBe("hiragana");
    expect(kanaScript(fieldInfo({ name: "x", pattern: "[\\u3041-\\u3096]+" }))).toBe("hiragana");
    expect(kanaScript(fieldInfo({ name: "x", pattern: "^[ｦ-ﾟ]+$" }))).toBe("halfwidth");
  });
});

describe("nameSeparator", () => {
  it("uses a full-width space by default", () => {
    expect(nameSeparator(fieldInfo({}))).toBe("　");
  });

  it("drops the space when told to", () => {
    expect(nameSeparator(fieldInfo({ label: "フリガナ（スペースなし）" }))).toBe("");
    expect(nameSeparator(fieldInfo({ placeholder: "姓名を続けて入力" }))).toBe("");
  });

  it("copies a half-width space from the placeholder", () => {
    expect(nameSeparator(fieldInfo({ placeholder: "やまだ たろう" }))).toBe(" ");
  });
});

describe("wantsHyphen", () => {
  it("defaults to a hyphen", () => {
    expect(wantsHyphen(fieldInfo({}), 7, 8)).toBe(true);
  });

  it("drops it when maxlength is too short", () => {
    expect(wantsHyphen(fieldInfo({ maxlength: 7 }), 7, 8)).toBe(false);
    expect(wantsHyphen(fieldInfo({ maxlength: 8 }), 7, 8)).toBe(true);
    expect(wantsHyphen(fieldInfo({ maxlength: 11 }), 11, 13)).toBe(false);
  });

  it("follows the placeholder", () => {
    expect(wantsHyphen(fieldInfo({ maxlength: 7, placeholder: "100-0001" }), 7, 8)).toBe(true);
    expect(wantsHyphen(fieldInfo({ placeholder: "〒100-0001" }), 7, 8)).toBe(true);
    expect(wantsHyphen(fieldInfo({ placeholder: "1000001" }), 7, 8)).toBe(false);
  });

  it("follows a pattern that fixes the digit count", () => {
    expect(wantsHyphen(fieldInfo({ pattern: "\\d{7}" }), 7, 8)).toBe(false);
  });
});

describe("pickOption", () => {
  it("matches the value first", () => {
    const o = [
      { value: "13", text: "東京都" },
      { value: "27", text: "大阪府" },
    ];
    expect(pickOption(o, ["東京都", "東京", "13"])).toBe("13");
  });

  it("matches the text when the value is opaque", () => {
    const o = [
      { value: "a", text: "東京都" },
      { value: "b", text: "大阪府" },
    ];
    expect(pickOption(o, ["東京都"])).toBe("a");
  });

  it("matches partially for words but not for numbers", () => {
    expect(pickOption(opts("東京都", "大阪府"), ["東京"])).toBe("東京都");
    expect(pickOption(opts("15", "5"), ["5"])).toBe("5");
    expect(pickOption(opts("15", "25"), ["5"])).toBeNull();
  });

  it("skips the placeholder row", () => {
    const o = [{ value: "", text: "選択してください" }, ...opts("東京都")];
    expect(pickOption(o, ["選択してください"])).toBeNull();
    expect(pickOption(o, ["東京都"])).toBe("東京都");
  });

  it("folds width and case", () => {
    expect(pickOption(opts("Ｈ", "Ｒ"), ["h"])).toBe("Ｈ");
  });

  it("returns null when nothing fits", () => {
    expect(pickOption(opts("りんご"), ["東京都"])).toBeNull();
  });
});

describe("render / names", () => {
  it("joins family and given with a full-width space", () => {
    expect(value("name_full")).toBe("山田　太郎");
    expect(value("name_family")).toBe("山田");
    expect(value("name_given")).toBe("太郎");
  });

  it("writes kana in katakana by default and in hiragana when asked", () => {
    expect(value("kana_full", { name: "kana" })).toBe("ヤマダ　タロウ");
    expect(value("kana_family", { placeholder: "セイ" })).toBe("ヤマダ");
    expect(value("kana_given", { placeholder: "めい" })).toBe("たろう");
    expect(value("kana_full", { placeholder: "やまだ たろう" })).toBe("やまだ たろう");
  });

  it("writes half-width kana when the pattern asks for it", () => {
    expect(value("kana_family", { pattern: "^[ｦ-ﾟ]+$" })).toBe("ﾔﾏﾀﾞ");
  });

  it("writes the company reading", () => {
    expect(value("company_kana", { label: "会社名（フリガナ）" })).toBe("ヤマダショウジ");
  });
});

describe("render / postal", () => {
  it("writes the zip with a hyphen by default", () => {
    expect(value("postal")).toBe("100-0013");
  });

  it("drops the hyphen for a 7-character field", () => {
    expect(value("postal", { maxlength: 7 })).toBe("1000013");
  });

  it("splits into 3 + 4", () => {
    expect(value("postal_1")).toBe("100");
    expect(value("postal_2")).toBe("0013");
  });

  it("writes full-width digits when the label says 全角", () => {
    expect(value("postal", { label: "郵便番号（全角）" })).toBe("１００－００１３");
    expect(value("postal_1", { label: "郵便番号（全角）" })).toBe("１００");
  });

  it("keeps half-width digits when inputmode or pattern insists", () => {
    expect(value("postal", { label: "全角", inputmode: "numeric" })).toBe("100-0013");
    expect(value("postal", { label: "全角", pattern: "\\d{3}-\\d{4}" })).toBe("100-0013");
  });
});

describe("render / address", () => {
  it("picks the prefecture from a select by name, short name or code", () => {
    expect(
      value("prefecture", { tag: "select", options: opts("北海道", "東京都", "大阪府") }),
    ).toBe("東京都");
    expect(value("prefecture", { tag: "select", options: opts("北海道", "東京", "大阪") })).toBe(
      "東京",
    );
    const coded = [
      { value: "01", text: "北海道" },
      { value: "13", text: "東京都" },
    ];
    expect(value("prefecture", { tag: "select", options: coded })).toBe("13");
  });

  it("writes the prefecture name into a text field", () => {
    expect(value("prefecture")).toBe("東京都");
  });

  it("returns null when the select has no matching prefecture", () => {
    expect(value("prefecture", { tag: "select", options: opts("北海道", "沖縄県") })).toBeNull();
  });

  it("writes town and block when prefecture and city fields exist", () => {
    expect(value("town")).toBe("霞が関1-2-3");
  });

  it("prepends the city when the form has no city field", () => {
    expect(value("town", {}, ["prefecture", "town", "building"])).toBe("千代田区霞が関1-2-3");
  });

  it("prepends the prefecture too when the form has neither", () => {
    expect(value("town", {}, ["town", "building"])).toBe("東京都千代田区霞が関1-2-3");
  });

  it("appends the building when the form has no building field", () => {
    expect(value("town", {}, ["prefecture", "city", "town"])).toBe("霞が関1-2-3 霞が関ビル 403");
    expect(value("address_full", {}, ["address_full"])).toBe(
      "東京都千代田区霞が関1-2-3 霞が関ビル 403",
    );
    expect(value("address_full", {}, ["address_full", "building"])).toBe(
      "東京都千代田区霞が関1-2-3",
    );
  });

  it("writes city and building", () => {
    expect(value("city")).toBe("千代田区");
    expect(value("building")).toBe("霞が関ビル 403");
  });

  it("writes the address reading with the block digits as they are", () => {
    expect(value("address_kana", { name: "address_kana" })).toBe(
      "トウキョウトチヨダクカスミガセキ1-2-3",
    );
    expect(value("address_kana", { label: "住所（ふりがな）" })).toBe(
      "とうきょうとちよだくかすみがせき1-2-3",
    );
    expect(value("prefecture_kana")).toBe("トウキョウト");
    expect(value("city_kana")).toBe("チヨダク");
    expect(value("town_kana")).toBe("カスミガセキ1-2-3");
  });
});

describe("render / phone", () => {
  it("writes the mobile with hyphens by default", () => {
    expect(value("tel")).toBe("090-0123-4567");
  });

  it("drops hyphens for an 11-character field or a plain placeholder", () => {
    expect(value("tel", { maxlength: 11 })).toBe("09001234567");
    expect(value("tel", { placeholder: "09000000000" })).toBe("09001234567");
    expect(value("tel", { placeholder: "090-0000-0000" })).toBe("090-0123-4567");
  });

  it("uses the landline when the label says 固定電話, and for fax", () => {
    expect(value("tel", { label: "固定電話" })).toBe("03-1234-5678");
    expect(value("fax")).toBe("03-1234-5678");
    expect(value("fax", { maxlength: 10 })).toBe("0312345678");
  });

  it("splits into three", () => {
    expect(value("tel_1")).toBe("090");
    expect(value("tel_2")).toBe("0123");
    expect(value("tel_3")).toBe("4567");
    expect(value("tel_12")).toBe("090-0123");
    expect(value("tel_23")).toBe("0123-4567");
  });

  it("splits the landline when the label asks for it", () => {
    expect(value("tel_1", { label: "固定電話（市外局番）" })).toBe("03");
  });

  it("writes full-width digits when asked", () => {
    expect(value("tel", { label: "電話番号（全角）" })).toBe("０９０－０１２３－４５６７");
  });
});

describe("phonePart", () => {
  it("cuts a hyphenated number", () => {
    expect(phonePart("03-1234-5678", "tel_1")).toBe("03");
    expect(phonePart("03-1234-5678", "tel_23")).toBe("1234-5678");
    expect(phonePart("03-1234-5678", "tel")).toBe("03-1234-5678");
  });
});

describe("render / account", () => {
  it("writes the same email and password into the confirmation fields", () => {
    expect(value("email")).toBe("tarou.yamada@example.jp");
    expect(value("email_confirm")).toBe("tarou.yamada@example.jp");
    expect(value("password")).toBe("Dummy!Pass01");
    expect(value("password_confirm")).toBe("Dummy!Pass01");
    expect(value("username")).toBe("yamada_tarou");
  });
});

describe("render / birth", () => {
  it("writes ISO into a date input", () => {
    expect(value("birth", { type: "date" })).toBe("1990-05-14");
  });

  it("follows the placeholder for a text input", () => {
    expect(value("birth")).toBe("1990/05/14");
    expect(value("birth", { placeholder: "yyyy-mm-dd" })).toBe("1990-05-14");
    expect(value("birth", { placeholder: "1990年1月1日" })).toBe("1990年5月14日");
    expect(value("birth", { placeholder: "YYYY/M/D" })).toBe("1990/5/14");
    expect(value("birth", { placeholder: "1990/1/1" })).toBe("1990/5/14");
    expect(value("birth", { maxlength: 8 })).toBe("19900514");
  });

  it("writes the western year without an era field", () => {
    expect(value("birth_y", {}, ["birth_y", "birth_m", "birth_d"])).toBe("1990");
  });

  it("writes the era year when the form has an era field", () => {
    expect(value("birth_y", {}, ["era", "birth_y", "birth_m", "birth_d"])).toBe("2");
  });

  it("picks year, month and day from selects in any of the usual spellings", () => {
    const years = opts("1989", "1990", "1991");
    expect(value("birth_y", { tag: "select", options: years }, ["birth_y"])).toBe("1990");
    const wareki = [{ value: "", text: "--" }, ...opts("1", "2", "3")];
    expect(value("birth_y", { tag: "select", options: wareki }, ["era", "birth_y"])).toBe("2");
    // 元号の欄はあるのに select は西暦、という組み合わせでも当たる。
    expect(value("birth_y", { tag: "select", options: years }, ["era", "birth_y"])).toBe("1990");
    expect(value("birth_m", { tag: "select", options: opts("04", "05", "06") })).toBe("05");
    expect(value("birth_m", { tag: "select", options: opts("4月", "5月", "6月") })).toBe("5月");
    expect(value("birth_d", { tag: "select", options: opts("13", "14", "15") })).toBe("14");
  });

  it("writes month and day as plain numbers into text fields", () => {
    expect(value("birth_m")).toBe("5");
    expect(value("birth_d")).toBe("14");
  });

  it("picks the era by name, initial or code", () => {
    expect(value("era", { tag: "select", options: opts("昭和", "平成", "令和") })).toBe("平成");
    expect(value("era", { tag: "select", options: opts("S", "H", "R") })).toBe("H");
    const coded = [
      { value: "3", text: "昭和" },
      { value: "4", text: "平成" },
    ];
    expect(value("era", { tag: "select", options: coded })).toBe("4");
    expect(value("era")).toBe("平成");
  });

  it("writes the age", () => {
    expect(value("age")).toBe("36");
  });

  it("picks the gender from radios or selects", () => {
    const radios = [
      { value: "1", text: "男性" },
      { value: "2", text: "女性" },
    ];
    expect(value("gender", { type: "radio", options: radios })).toBe("1");
    expect(value("gender", { tag: "select", options: opts("female", "male") })).toBe("male");
    expect(value("gender")).toBe("男性");
  });
});

describe("render / company and misc", () => {
  it("writes company, department, title and url", () => {
    expect(value("company")).toBe("山田商事株式会社");
    expect(value("department")).toBe("営業部");
    expect(value("job_title")).toBe("課長");
    expect(value("url")).toBe("https://example.jp/");
  });

  it("falls back to the first real option for department and title selects", () => {
    expect(
      value("job_title", { tag: "select", options: opts("選択してください", "部長", "課長") }),
    ).toBe("課長");
    expect(value("job_title", { tag: "select", options: opts("選択してください", "社長") })).toBe(
      "社長",
    );
  });

  it("writes Japanese sentences, not lorem ipsum", () => {
    const m = value("message") ?? "";
    expect(m).toMatch(/。/);
    expect(m).not.toMatch(/lorem/i);
    expect(value("text")).toBe("テスト入力");
  });

  it("turns agree on and leaves other checkboxes alone", () => {
    expect(value("agree", { type: "checkbox" })).toBe("on");
    expect(value("checkbox", { type: "checkbox" })).toBeNull();
    expect(value("skip")).toBeNull();
  });

  it("keeps a number inside min and max", () => {
    const n = Number(value("number", { type: "number", min: 10, max: 12 }));
    expect(n).toBeGreaterThanOrEqual(10);
    expect(n).toBeLessThanOrEqual(12);
    const d = Number(value("number", { type: "number" }));
    expect(d).toBeGreaterThanOrEqual(1);
    expect(d).toBeLessThanOrEqual(100);
  });

  it("picks the first real option of an unknown select or radio", () => {
    const o = [{ value: "", text: "選択してください" }, ...opts("会社員", "学生")];
    expect(value("select", { tag: "select", options: o })).toBe("会社員");
    expect(value("radio", { type: "radio", options: opts("A", "B") })).toBe("A");
    expect(value("select", { tag: "select", options: [{ value: "", text: "---" }] })).toBeNull();
  });
});

describe("appendix", () => {
  it("adds block and building when the form has no building field", () => {
    expect(appendix(PERSON, new Set(["town"]))).toEqual({
      endsWith: "霞が関",
      add: "1-2-3 霞が関ビル 403",
    });
  });

  it("adds only the block when a building field exists", () => {
    expect(appendix(PERSON, new Set(["town", "building"]))).toEqual({
      endsWith: "霞が関",
      add: "1-2-3",
    });
  });
});

describe("lessons from real forms", () => {
  it("reads the digit example in the placeholder to decide on hyphens", () => {
    expect(value("postal", { placeholder: "例：5300001" })).toBe("1000013");
    expect(value("tel", { placeholder: "(例) 09012345678" })).toBe("09001234567");
    expect(value("tel", { placeholder: "例）03-1234-5678" })).toBe("090-0123-4567");
    expect(value("postal", { placeholder: "例：530-0001" })).toBe("100-0013");
  });

  it("follows ハイフン無し / ハイフン区切り in the label", () => {
    expect(value("tel", { label: "電話番号(ハイフン無し・半角数字)" })).toBe("09001234567");
    expect(value("postal", { label: "郵便番号（ハイフンなし）" })).toBe("1000013");
    expect(value("tel", { label: "電話番号（ハイフン区切り）", maxlength: 11 })).toBe(
      "090-0123-4567",
    );
  });

  it("writes the birth date with hyphens when the aria-label asks for them", () => {
    expect(
      value("birth", { ariaLabel: "生年月日 年月日をハイフン区切りで入力してください。" }),
    ).toBe("1990-05-14");
    expect(value("birth", { label: "生年月日（スラッシュ区切り）" })).toBe("1990/05/14");
  });

  it("falls back to the first option when a free-text kind lands on a select", () => {
    const o = [
      { value: "", text: "選択してください" },
      { value: "導入について", text: "導入について" },
      { value: "料金について", text: "料金について" },
    ];
    expect(value("message", { tag: "select", type: "", options: o })).toBe("導入について");
    expect(value("company", { tag: "select", type: "", options: o })).toBe("導入について");
    // 都道府県のように候補で当てるものは、当たらなければ null のまま。
    expect(value("prefecture", { tag: "select", type: "", options: o })).toBeNull();
  });
});

describe("render / four-way address split (Amazon)", () => {
  const amazon: FieldKind[] = ["prefecture", "city", "block", "building", "room", "country"];

  it("puts the town into the city field when the block has its own field", () => {
    expect(value("city", {}, amazon)).toBe("千代田区霞が関");
    expect(value("block", {}, amazon)).toBe("1-2-3");
  });

  it("keeps the city alone when a town field exists", () => {
    const kinds: FieldKind[] = ["prefecture", "city", "town", "block", "building"];
    expect(value("city", {}, kinds)).toBe("千代田区");
    expect(value("town", {}, kinds)).toBe("霞が関");
    // 建物の欄が無ければ、町名の欄に建物が続くのは他の形と同じ。
    expect(value("town", {}, ["prefecture", "city", "town", "block"])).toBe(
      "霞が関 霞が関ビル 403",
    );
  });

  it("splits building name and room number", () => {
    expect(value("building", {}, amazon)).toBe("霞が関ビル");
    expect(value("room", {}, amazon)).toBe("403");
    expect(value("building", {}, ["prefecture", "city", "town", "building"])).toBe(
      "霞が関ビル 403",
    );
  });

  it("picks Japan in a country select and leaves an unmatched one alone", () => {
    const countries = [
      { value: "AL", text: "Albania" },
      { value: "JP", text: "Japan" },
    ];
    expect(value("country", { tag: "select", type: "", options: countries })).toBe("JP");
    expect(value("country", { tag: "select", type: "", options: opts("日本", "アメリカ") })).toBe(
      "日本",
    );
    expect(
      value("country", { tag: "select", type: "", options: opts("Albania", "Algeria") }),
    ).toBeNull();
    expect(value("country")).toBe("日本");
  });

  it("does not fall back to the first option for an address kind on a select", () => {
    const countries = [{ value: "AL", text: "Albania" }];
    expect(value("address_full", { tag: "select", type: "", options: countries })).toBeNull();
    expect(value("name_full", { tag: "select", type: "", options: countries })).toBeNull();
  });
});

describe("payment, corporate number, romaji, future date", () => {
  const ctx: RenderContext = { today: TODAY, kinds: new Set() };
  const v = (kind: FieldKind, over: Partial<FieldInfo> = {}): string | null =>
    render(kind, PERSON, fieldInfo(over), ctx);

  it("card number: plain by default, grouped when the field shows groups", () => {
    expect(v("card_number")).toBe("4242424242424242");
    expect(v("card_number", { maxlength: 16 })).toBe("4242424242424242");
    expect(v("card_number", { maxlength: 19 })).toBe("4242 4242 4242 4242");
    expect(v("card_number", { placeholder: "1234-5678-9012-3456" })).toBe("4242-4242-4242-4242");
    expect(v("card_1")).toBe("4242");
    expect(v("card_4")).toBe("4242");
  });

  it("cardholder: given name first in upper case, following the example otherwise", () => {
    expect(v("card_holder")).toBe("TAROU YAMADA");
    expect(v("card_holder", { placeholder: "YAMADA TARO" })).toBe("YAMADA TAROU");
    expect(v("card_holder", { placeholder: "Taro Yamada" })).toBe("Tarou Yamada");
  });

  it("expiry: MM/YY by default, following the placeholder and the type", () => {
    expect(v("card_expiry")).toBe("12/29");
    expect(v("card_expiry", { placeholder: "MM/YYYY" })).toBe("12/2029");
    expect(v("card_expiry", { placeholder: "YY/MM" })).toBe("29/12");
    expect(v("card_expiry", { placeholder: "MMYY" })).toBe("1229");
    expect(v("card_expiry", { maxlength: 4 })).toBe("1229");
    expect(v("card_expiry", { type: "month" })).toBe("2029-12");
  });

  it("expiry month and year: text and select", () => {
    expect(v("card_expiry_month")).toBe("12");
    expect(v("card_expiry_year")).toBe("2029");
    expect(v("card_expiry_year", { maxlength: 2 })).toBe("29");
    const months = Array.from({ length: 12 }, (_, i) => ({
      value: String(i + 1),
      text: `${i + 1}月`,
    }));
    expect(v("card_expiry_month", { tag: "select", type: "", options: months })).toBe("12");
    const years = [2026, 2027, 2028, 2029, 2030].map((y) => ({
      value: String(y).slice(2),
      text: String(y),
    }));
    expect(v("card_expiry_year", { tag: "select", type: "", options: years })).toBe("29");
  });

  it("security code: 3 digits, 4 for a 4-digit box", () => {
    expect(v("card_cvc")).toBe("123");
    expect(v("card_cvc", { maxlength: 4 })).toBe("1234");
  });

  it("brand: picks VISA, falls back to the first brand", () => {
    const brands = [
      { value: "", text: "選択" },
      { value: "mc", text: "Mastercard" },
      { value: "vi", text: "VISA" },
    ];
    expect(v("card_brand", { tag: "select", type: "", options: brands })).toBe("vi");
    const jcb = [
      { value: "", text: "選択" },
      { value: "jcb", text: "JCB" },
    ];
    expect(v("card_brand", { tag: "select", type: "", options: jcb })).toBe("jcb");
    const radios = [
      { value: "jcb", text: "JCB" },
      { value: "visa", text: "Visa" },
    ];
    expect(v("card_brand", { type: "radio", options: radios })).toBe("visa");
  });

  it("corporate and invoice numbers", () => {
    expect(v("corporate_number")).toBe("8123456789012");
    expect(v("corporate_number", { label: "法人番号（全角）" })).toBe("８１２３４５６７８９０１２");
    expect(v("invoice_number")).toBe("T8123456789012");
  });

  it("romaji names", () => {
    expect(v("name_romaji")).toBe("TAROU YAMADA");
    expect(v("name_romaji", { label: "氏名（ローマ字）姓 名" })).toBe("YAMADA TAROU");
    expect(v("name_romaji_family")).toBe("YAMADA");
    expect(v("name_romaji_given", { placeholder: "Taro" })).toBe("Tarou");
  });

  it("future date: a week ahead, skipping the weekend", () => {
    // TODAY は 2026-09-05（土）。7 日後の 09-12 も土なので、次の月曜 09-14。
    expect(v("date_future", { type: "date" })).toBe("2026-09-14");
    expect(v("date_future")).toBe("2026/09/14");
    expect(v("date_future", { placeholder: "2026/9/1" })).toBe("2026/9/14");
    const days = [
      { value: "", text: "選択" },
      { value: "a", text: "9月10日" },
    ];
    expect(v("date_future", { tag: "select", type: "", options: days })).toBe("a");
    expect(futureDate(new Date(2026, 8, 17))).toEqual({ y: 2026, m: 9, d: 24 });
  });
});

describe("English fields and URL placeholders", () => {
  const ctx: RenderContext = { today: TODAY, kinds: new Set() };
  const v = (kind: FieldKind, over: Partial<FieldInfo> = {}): string | null =>
    render(kind, PERSON, fieldInfo(over), ctx);

  it("builds the URL under the placeholder's domain", () => {
    expect(v("url", { placeholder: "https://facebook.com" })).toBe(
      "https://facebook.com/yamada_tarou",
    );
    expect(v("url", { placeholder: "https://www.linkedin.com/in/your-name" })).toBe(
      "https://www.linkedin.com/yamada_tarou",
    );
    expect(v("url")).toBe("https://example.jp/");
    expect(v("url", { placeholder: "ホームページ" })).toBe("https://example.jp/");
  });

  it("writes English into fields whose hints are all English", () => {
    expect(v("text", { label: "Nickname" })).toBe("Test input");
    expect(v("text", { label: "ニックネーム" })).toBe("テスト入力");
    expect(v("text")).toBe("テスト入力");
    expect(
      v("message", { tag: "textarea", type: "", placeholder: "Tell us about yourself" }),
    ).toMatch(/^This is a test entry/);
    expect(v("message", { tag: "textarea", type: "", label: "自己紹介" })).toMatch(
      /^テスト用の入力です/,
    );
  });
});
