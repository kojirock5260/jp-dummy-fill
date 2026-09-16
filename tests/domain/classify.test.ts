import { describe, expect, it } from "vitest";
import {
  analyze,
  classify,
  featuresOfLabel,
  featuresOfOptions,
  normalizeLabel,
  tokenize,
} from "../../src/domain/classify";
import { type FieldInfo, type FieldKind, fieldInfo } from "../../src/domain/field";

/**
 * 1 欄だけの判定。form 全体を見る補正は掛からない。
 *
 * @param over 欄の属性
 * @returns 欄種
 */
const one = (over: Partial<FieldInfo>): FieldKind => analyze(fieldInfo(over)).kind;

/** `docs/field-rules.md` §2 の表を 1 行ずつ確かめる。[説明, 欄, 期待する欄種]。 */
type Row = [string, Partial<FieldInfo>, FieldKind];

/**
 * 表を it に展開する。
 *
 * @param rows 確かめる行
 */
function table(rows: Row[]): void {
  for (const [title, over, kind] of rows) {
    it(`${title} → ${kind}`, () => {
      expect(one(over)).toBe(kind);
    });
  }
}

const PREFS = ["北海道", "青森県", "東京都", "大阪府", "福岡県", "沖縄県"].map((t) => ({
  value: t,
  text: t,
}));

describe("tokenize", () => {
  it("splits on [] - _ . and lowercases", () => {
    expect(tokenize("user[Email_Address]").words).toEqual(["user", "email", "address"]);
    expect(tokenize("zip-code.main").words).toEqual(["zip", "code", "main"]);
  });

  it("splits camelCase", () => {
    expect(tokenize("firstName").words).toEqual(["first", "name"]);
    expect(tokenize("zipCode1")).toEqual({ words: ["zip", "code"], idx: 1 });
  });

  it("keeps a trailing number as the split index", () => {
    expect(tokenize("zip1")).toEqual({ words: ["zip"], idx: 1 });
    expect(tokenize("tel_3")).toEqual({ words: ["tel"], idx: 3 });
    expect(tokenize("address[2]")).toEqual({ words: ["address"], idx: 2 });
  });

  it("leaves autocomplete-style words like line1 alone", () => {
    expect(tokenize("address_line1")).toEqual({ words: ["address", "line1"], idx: null });
    expect(tokenize("address_level1")).toEqual({ words: ["address", "level1"], idx: null });
  });

  it("returns nothing for an empty name", () => {
    expect(tokenize("")).toEqual({ words: [], idx: null });
  });
});

describe("normalizeLabel", () => {
  it("drops required marks and whitespace", () => {
    expect(normalizeLabel("氏名 ※必須")).toBe("氏名");
    expect(normalizeLabel("お名前（必須）")).toBe("お名前");
    expect(normalizeLabel("【必須】メールアドレス")).toBe("メールアドレス");
  });

  it("folds full-width letters and digits", () => {
    expect(normalizeLabel("ＴＥＬ")).toBe("tel");
    expect(normalizeLabel("郵便番号（前３桁）")).toBe("郵便番号(前3桁)");
  });
});

describe("featuresOfLabel", () => {
  it("reads 名 only when the label is exactly that", () => {
    expect(featuresOfLabel("名").has("given")).toBe(true);
    expect(featuresOfLabel("名（漢字）").has("given")).toBe(true);
    expect(featuresOfLabel("名（フリガナ）").has("given")).toBe(true);
    expect(featuresOfLabel("会社名").has("given")).toBe(false);
    expect(featuresOfLabel("氏名").has("given")).toBe(false);
    expect(featuresOfLabel("建物名").has("given")).toBe(false);
  });

  it("does not read 姓 out of 姓名", () => {
    const f = featuresOfLabel("姓名");
    expect(f.has("fullname")).toBe(true);
    expect(f.has("family")).toBe(false);
  });

  it("does not read かな out of ひらがな twice, but still sees kana", () => {
    const f = featuresOfLabel("ひらがな");
    expect(f.has("kana")).toBe(true);
    expect(f.has("hiragana")).toBe(true);
  });

  it("reads the script hint from the kana word itself", () => {
    expect(featuresOfLabel("フリガナ").has("katakana")).toBe(true);
    expect(featuresOfLabel("ふりがな").has("hiragana")).toBe(true);
  });
});

describe("featuresOfOptions", () => {
  it("recognizes a prefecture list whatever the select is called", () => {
    expect(featuresOfOptions(PREFS).has("pref")).toBe(true);
  });

  it("recognizes eras and genders", () => {
    const eras = ["昭和", "平成", "令和"].map((t) => ({ value: t, text: t }));
    expect(featuresOfOptions(eras).has("era")).toBe(true);
    const genders = [
      { value: "1", text: "男性" },
      { value: "2", text: "女性" },
    ];
    expect(featuresOfOptions(genders).has("gender")).toBe(true);
  });

  it("recognizes a run of years, months or days after a placeholder option", () => {
    const years = [
      { value: "", text: "----" },
      ...Array.from({ length: 60 }, (_, i) => ({ value: String(1950 + i), text: `${1950 + i}年` })),
    ];
    expect(featuresOfOptions(years).has("year")).toBe(true);
    const months = Array.from({ length: 12 }, (_, i) => ({
      value: String(i + 1),
      text: `${i + 1}`,
    }));
    expect(featuresOfOptions(months).has("month")).toBe(true);
    const days = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), text: `${i + 1}` }));
    expect(featuresOfOptions(days).has("day")).toBe(true);
  });

  it("says nothing about a short list of unrelated words", () => {
    const f = featuresOfOptions([
      { value: "a", text: "りんご" },
      { value: "b", text: "みかん" },
    ]);
    expect(f.size).toBe(0);
  });
});

describe("§2.1 氏名", () => {
  table([
    ["name", { name: "name" }, "name_full"],
    ["fullname", { name: "fullname" }, "name_full"],
    ["full_name", { name: "full_name" }, "name_full"],
    ["shimei", { name: "shimei" }, "name_full"],
    ["onamae", { name: "onamae" }, "name_full"],
    ["label 氏名", { name: "f1", label: "氏名" }, "name_full"],
    ["label お名前", { name: "f1", label: "お名前" }, "name_full"],
    ["label ご氏名 必須", { name: "f1", label: "ご氏名 ※必須" }, "name_full"],
    ["autocomplete name", { name: "f1", autocomplete: "name" }, "name_full"],
    ["Rails user[name] with label", { name: "user[name]", label: "お名前" }, "name_full"],

    ["sei", { name: "sei" }, "name_family"],
    ["last_name", { name: "last_name" }, "name_family"],
    ["lastname", { name: "lastname" }, "name_family"],
    ["lname", { name: "lname" }, "name_family"],
    ["family_name", { name: "family_name" }, "name_family"],
    ["surname", { name: "surname" }, "name_family"],
    ["myoji", { name: "myoji" }, "name_family"],
    ["label 姓", { name: "f1", label: "姓" }, "name_family"],
    ["label 苗字", { name: "f1", label: "苗字" }, "name_family"],
    ["placeholder 姓", { name: "f1", placeholder: "姓" }, "name_family"],
    ["autocomplete family-name", { name: "f1", autocomplete: "family-name" }, "name_family"],
    ["name1", { name: "name1" }, "name_family"],

    ["mei", { name: "mei" }, "name_given"],
    ["first_name", { name: "first_name" }, "name_given"],
    ["firstName", { name: "firstName" }, "name_given"],
    ["fname", { name: "fname" }, "name_given"],
    ["given_name", { name: "given_name" }, "name_given"],
    ["label 名", { name: "f1", label: "名" }, "name_given"],
    ["label 名（漢字）", { name: "f1", label: "名（漢字）" }, "name_given"],
    ["autocomplete given-name", { name: "f1", autocomplete: "given-name" }, "name_given"],
    ["name2", { name: "name2" }, "name_given"],
  ]);

  it("does not take 名 out of 会社名 or 建物名", () => {
    expect(one({ name: "f1", label: "会社名" })).toBe("company");
    expect(one({ name: "f1", label: "建物名" })).toBe("building");
  });
});

describe("§2.2 カナ", () => {
  table([
    ["kana", { name: "kana" }, "kana_full"],
    ["furigana", { name: "furigana" }, "kana_full"],
    ["yomi", { name: "yomi" }, "kana_full"],
    ["ruby", { name: "ruby" }, "kana_full"],
    ["name_kana", { name: "name_kana" }, "kana_full"],
    ["namekana", { name: "namekana" }, "kana_full"],
    ["full-name-phonetic", { name: "full-name-phonetic" }, "kana_full"],
    ["label フリガナ", { name: "f1", label: "フリガナ" }, "kana_full"],
    ["label ふりがな", { name: "f1", label: "ふりがな" }, "kana_full"],
    ["label よみがな", { name: "f1", label: "よみがな" }, "kana_full"],
    ["label お名前（カナ）", { name: "f1", label: "お名前（カナ）" }, "kana_full"],
    ["label セイメイ", { name: "f1", label: "セイメイ" }, "kana_full"],
    [
      "autocomplete name + label フリガナ",
      { autocomplete: "name", label: "フリガナ" },
      "kana_full",
    ],

    ["sei_kana", { name: "sei_kana" }, "kana_family"],
    ["kana_sei", { name: "kana_sei" }, "kana_family"],
    ["last_name_kana", { name: "last_name_kana" }, "kana_family"],
    ["family-name-phonetic", { name: "family-name-phonetic" }, "kana_family"],
    ["sei_furigana", { name: "sei_furigana" }, "kana_family"],
    ["label セイ", { name: "f1", label: "セイ" }, "kana_family"],
    ["label せい", { name: "f1", label: "せい" }, "kana_family"],
    ["label 姓（フリガナ）", { name: "f1", label: "姓（フリガナ）" }, "kana_family"],
    ["label 姓（カナ）", { name: "f1", label: "姓（カナ）" }, "kana_family"],
    ["label 姓ふりがな", { name: "f1", label: "姓ふりがな" }, "kana_family"],
    ["placeholder セイ", { name: "f1", placeholder: "セイ" }, "kana_family"],
    [
      "autocomplete family-name + セイ",
      { autocomplete: "family-name", label: "セイ" },
      "kana_family",
    ],
    ["kana1", { name: "kana1" }, "kana_family"],

    ["mei_kana", { name: "mei_kana" }, "kana_given"],
    ["kana_mei", { name: "kana_mei" }, "kana_given"],
    ["first_name_kana", { name: "first_name_kana" }, "kana_given"],
    ["given-name-phonetic", { name: "given-name-phonetic" }, "kana_given"],
    ["mei_furigana", { name: "mei_furigana" }, "kana_given"],
    ["label メイ", { name: "f1", label: "メイ" }, "kana_given"],
    ["label めい", { name: "f1", label: "めい" }, "kana_given"],
    ["label 名（フリガナ）", { name: "f1", label: "名（フリガナ）" }, "kana_given"],
    ["label 名（カナ）", { name: "f1", label: "名（カナ）" }, "kana_given"],
    ["label 名ふりがな", { name: "f1", label: "名ふりがな" }, "kana_given"],
    ["kana2", { name: "kana2" }, "kana_given"],

    ["company_kana", { name: "company_kana" }, "company_kana"],
    ["corp_kana", { name: "corp_kana" }, "company_kana"],
    ["kaisha_kana", { name: "kaisha_kana" }, "company_kana"],
    ["label 会社名（フリガナ）", { name: "f1", label: "会社名（フリガナ）" }, "company_kana"],
    ["label 法人名（カナ）", { name: "f1", label: "法人名（カナ）" }, "company_kana"],
  ]);

  it("prefers kana over name when both words are present", () => {
    expect(one({ name: "sei_kana" })).toBe("kana_family");
    expect(one({ name: "name", label: "フリガナ" })).toBe("kana_full");
  });
});

describe("§2.3 住所", () => {
  table([
    ["zip", { name: "zip" }, "postal"],
    ["zipcode", { name: "zipcode" }, "postal"],
    ["zip_code", { name: "zip_code" }, "postal"],
    ["postcode", { name: "postcode" }, "postal"],
    ["postal", { name: "postal" }, "postal"],
    ["postal_code", { name: "postal_code" }, "postal"],
    ["yubin", { name: "yubin" }, "postal"],
    ["label 郵便番号", { name: "f1", label: "郵便番号" }, "postal"],
    ["label 〒", { name: "f1", label: "〒" }, "postal"],
    ["autocomplete postal-code", { name: "f1", autocomplete: "postal-code" }, "postal"],

    ["zip1", { name: "zip1" }, "postal_1"],
    ["zip2", { name: "zip2" }, "postal_2"],
    ["zip_a", { name: "zip_a" }, "postal_1"],
    ["zip_b", { name: "zip_b" }, "postal_2"],
    ["zip_first", { name: "zip_first" }, "postal_1"],
    ["zip_second", { name: "zip_second" }, "postal_2"],
    ["zip_upper", { name: "zip_upper" }, "postal_1"],
    ["zip_lower", { name: "zip_lower" }, "postal_2"],
    ["zip3 (digit-count style)", { name: "zip3" }, "postal_1"],
    ["zip4 (digit-count style)", { name: "zip4" }, "postal_2"],
    ["label 郵便番号（前3桁）", { name: "f1", label: "郵便番号（前3桁）" }, "postal_1"],
    ["label 郵便番号（後4桁）", { name: "f2", label: "郵便番号（後4桁）" }, "postal_2"],

    ["pref", { name: "pref" }, "prefecture"],
    ["prefecture", { name: "prefecture" }, "prefecture"],
    ["todofuken", { name: "todofuken" }, "prefecture"],
    ["ken", { name: "ken" }, "prefecture"],
    ["state", { name: "state" }, "prefecture"],
    ["region", { name: "region" }, "prefecture"],
    ["province", { name: "province" }, "prefecture"],
    ["address_level1", { name: "address_level1" }, "prefecture"],
    ["addr_pref", { name: "addr_pref" }, "prefecture"],
    ["label 都道府県", { name: "f1", label: "都道府県" }, "prefecture"],
    ["autocomplete address-level1", { autocomplete: "address-level1" }, "prefecture"],
    [
      "select full of prefectures",
      { tag: "select", type: "", name: "item_3", options: PREFS },
      "prefecture",
    ],

    ["city", { name: "city" }, "city"],
    ["shikuchoson", { name: "shikuchoson" }, "city"],
    ["shiku", { name: "shiku" }, "city"],
    ["address_level2", { name: "address_level2" }, "city"],
    ["addr_city", { name: "addr_city" }, "city"],
    ["municipality", { name: "municipality" }, "city"],
    ["label 市区町村", { name: "f1", label: "市区町村" }, "city"],
    ["label 市区郡", { name: "f1", label: "市区郡" }, "city"],
    ["label 市町村", { name: "f1", label: "市町村" }, "city"],
    ["autocomplete address-level2", { autocomplete: "address-level2" }, "city"],

    ["town", { name: "town" }, "town"],
    ["street", { name: "street" }, "town"],
    ["address_line1", { name: "address_line1" }, "town"],
    ["addressline1", { name: "addressline1" }, "town"],
    ["address1", { name: "address1" }, "town"],
    ["addr1", { name: "addr1" }, "town"],
    ["banchi", { name: "banchi" }, "town"],
    ["chome", { name: "chome" }, "town"],
    ["address_detail", { name: "address_detail" }, "town"],
    ["label 町名", { name: "f1", label: "町名" }, "town"],
    ["label 番地", { name: "f1", label: "番地" }, "town"],
    ["label 町名・番地", { name: "f1", label: "町名・番地" }, "town"],
    ["label 丁目", { name: "f1", label: "丁目" }, "town"],
    ["label 住所1", { name: "f1", label: "住所1" }, "town"],
    ["label 住所１ (full-width)", { name: "f1", label: "住所１" }, "town"],
    ["label それ以降の住所", { name: "f1", label: "それ以降の住所" }, "town"],
    ["autocomplete address-line1", { autocomplete: "address-line1" }, "town"],

    ["building", { name: "building" }, "building"],
    ["tatemono", { name: "tatemono" }, "building"],
    ["address_line2", { name: "address_line2" }, "building"],
    ["address2", { name: "address2" }, "building"],
    ["addr2", { name: "addr2" }, "building"],
    ["room", { name: "room" }, "room"],
    ["mansion", { name: "mansion" }, "building"],
    ["apartment", { name: "apartment" }, "building"],
    ["label 建物名", { name: "f1", label: "建物名" }, "building"],
    ["label マンション名", { name: "f1", label: "マンション名" }, "building"],
    ["label 部屋番号", { name: "f1", label: "部屋番号" }, "room"],
    ["label 号室", { name: "f1", label: "号室" }, "room"],
    ["label 住所2", { name: "f1", label: "住所2" }, "building"],
    ["autocomplete address-line2", { autocomplete: "address-line2" }, "building"],

    ["address", { name: "address" }, "address_full"],
    ["jusho", { name: "jusho" }, "address_full"],
    ["juusho", { name: "juusho" }, "address_full"],
    ["addr", { name: "addr" }, "address_full"],
    ["label 住所", { name: "f1", label: "住所" }, "address_full"],
    ["label ご住所", { name: "f1", label: "ご住所" }, "address_full"],
    ["autocomplete street-address", { autocomplete: "street-address" }, "address_full"],

    ["address_kana", { name: "address_kana" }, "address_kana"],
    ["addr_kana", { name: "addr_kana" }, "address_kana"],
    ["jusho_kana", { name: "jusho_kana" }, "address_kana"],
    ["address_furigana", { name: "address_furigana" }, "address_kana"],
    ["label 住所（フリガナ）", { name: "f1", label: "住所（フリガナ）" }, "address_kana"],
    ["label 住所フリガナ", { name: "f1", label: "住所フリガナ" }, "address_kana"],
    ["label 住所カナ", { name: "f1", label: "住所カナ" }, "address_kana"],
    ["label ご住所（カナ）", { name: "f1", label: "ご住所（カナ）" }, "address_kana"],

    ["pref_kana", { name: "pref_kana" }, "prefecture_kana"],
    ["city_kana", { name: "city_kana" }, "city_kana"],
    ["town_kana", { name: "town_kana" }, "town_kana"],
    ["address1_kana", { name: "address1_kana" }, "town_kana"],
    ["label 都道府県（カナ）", { name: "f1", label: "都道府県（カナ）" }, "prefecture_kana"],
    ["label 市区町村（カナ）", { name: "f1", label: "市区町村（カナ）" }, "city_kana"],
    ["label 町名（カナ）", { name: "f1", label: "町名（カナ）" }, "town_kana"],
  ]);

  it("keeps address kana out of name kana", () => {
    expect(one({ name: "address_kana" })).not.toBe("kana_full");
  });
});

describe("§2.4 電話・FAX", () => {
  table([
    ["tel", { name: "tel" }, "tel"],
    ["phone", { name: "phone" }, "tel"],
    ["telephone", { name: "telephone" }, "tel"],
    ["mobile", { name: "mobile" }, "tel"],
    ["cellphone", { name: "cellphone" }, "tel"],
    ["keitai", { name: "keitai" }, "tel"],
    ["denwa", { name: "denwa" }, "tel"],
    ["contact_number", { name: "contact_number" }, "tel"],
    ["phone_number", { name: "phone_number" }, "tel"],
    ["label 電話番号", { name: "f1", label: "電話番号" }, "tel"],
    ["label 携帯電話", { name: "f1", label: "携帯電話" }, "tel"],
    ["label 携帯番号", { name: "f1", label: "携帯番号" }, "tel"],
    ["label TEL", { name: "f1", label: "TEL" }, "tel"],
    ["label 連絡先電話", { name: "f1", label: "連絡先電話" }, "tel"],
    ["type tel", { name: "f1", type: "tel" }, "tel"],
    ["autocomplete tel", { autocomplete: "tel" }, "tel"],

    ["tel1", { name: "tel1" }, "tel_1"],
    ["tel2", { name: "tel2" }, "tel_2"],
    ["tel3", { name: "tel3" }, "tel_3"],
    ["tel_a", { name: "tel_a" }, "tel_1"],
    ["tel_b", { name: "tel_b" }, "tel_2"],
    ["tel_c", { name: "tel_c" }, "tel_3"],
    ["tel_area", { name: "tel_area" }, "tel_1"],
    ["tel_local", { name: "tel_local" }, "tel_2"],
    ["label 市外局番", { name: "f1", label: "市外局番" }, "tel_1"],
    ["label 市内局番", { name: "f1", label: "市内局番" }, "tel_2"],
    ["label 加入者番号", { name: "f1", label: "加入者番号" }, "tel_3"],
    ["autocomplete tel-area-code", { autocomplete: "tel-area-code" }, "tel_1"],
    ["autocomplete tel-local-prefix", { autocomplete: "tel-local-prefix" }, "tel_2"],
    ["autocomplete tel-local-suffix", { autocomplete: "tel-local-suffix" }, "tel_3"],
    ["type tel with index", { name: "phone2", type: "tel" }, "tel_2"],

    ["fax", { name: "fax" }, "fax"],
    ["facsimile", { name: "facsimile" }, "fax"],
    ["label FAX", { name: "f1", label: "FAX" }, "fax"],
    ["label ファックス", { name: "f1", label: "ファックス" }, "fax"],
    ["type tel named fax", { name: "fax", type: "tel" }, "fax"],
  ]);

  it("leaves tel_number as a plain tel, for group.ts to place", () => {
    expect(one({ name: "tel_number" })).toBe("tel");
  });
});

describe("§2.5 メール・パスワード・ID", () => {
  table([
    ["email", { name: "email" }, "email"],
    ["mail", { name: "mail" }, "email"],
    ["e-mail", { name: "e-mail" }, "email"],
    ["mailaddress", { name: "mailaddress" }, "email"],
    ["mail_address", { name: "mail_address" }, "email"],
    ["label メールアドレス", { name: "f1", label: "メールアドレス" }, "email"],
    ["label メール", { name: "f1", label: "メール" }, "email"],
    ["label Eメール", { name: "f1", label: "Eメール" }, "email"],
    ["type email", { name: "f1", type: "email" }, "email"],
    ["autocomplete email", { autocomplete: "email" }, "email"],

    ["email_confirm", { name: "email_confirm" }, "email_confirm"],
    ["confirm_email", { name: "confirm_email" }, "email_confirm"],
    ["email2", { name: "email2" }, "email_confirm"],
    ["email_check", { name: "email_check" }, "email_confirm"],
    ["mail_confirm", { name: "mail_confirm" }, "email_confirm"],
    ["re_email", { name: "re_email" }, "email_confirm"],
    [
      "label メールアドレス（確認）",
      { name: "f1", label: "メールアドレス（確認）" },
      "email_confirm",
    ],
    ["type email + label 確認用", { name: "f1", type: "email", label: "確認用" }, "email_confirm"],
    ["type email + label 再入力", { name: "f1", type: "email", label: "再入力" }, "email_confirm"],
    [
      "autocomplete email + confirm word",
      { name: "confirm", autocomplete: "email" },
      "email_confirm",
    ],

    ["password", { name: "password" }, "password"],
    ["passwd", { name: "passwd" }, "password"],
    ["pass", { name: "pass" }, "password"],
    ["pw", { name: "pw" }, "password"],
    ["pwd", { name: "pwd" }, "password"],
    ["label パスワード", { name: "f1", label: "パスワード" }, "password"],
    ["type password", { name: "f1", type: "password" }, "password"],
    ["autocomplete new-password", { type: "password", autocomplete: "new-password" }, "password"],
    [
      "autocomplete current-password",
      { type: "password", autocomplete: "current-password" },
      "password",
    ],

    ["password_confirm", { name: "password_confirm" }, "password_confirm"],
    ["confirm_password", { name: "confirm_password" }, "password_confirm"],
    ["password2", { name: "password2" }, "password_confirm"],
    ["re_password", { name: "re_password" }, "password_confirm"],
    ["label パスワード（確認）", { name: "f1", label: "パスワード（確認）" }, "password_confirm"],
    ["type password + 確認", { type: "password", label: "パスワード（確認）" }, "password_confirm"],

    ["username", { name: "username" }, "username"],
    ["login_id", { name: "login_id" }, "username"],
    ["user_id", { name: "user_id" }, "username"],
    ["account", { name: "account" }, "username"],
    ["account_id", { name: "account_id" }, "username"],
    ["nickname", { name: "nickname" }, "username"],
    ["handle", { name: "handle" }, "username"],
    ["label ユーザー名", { name: "f1", label: "ユーザー名" }, "username"],
    ["label ユーザーID", { name: "f1", label: "ユーザーID" }, "username"],
    ["label ログインID", { name: "f1", label: "ログインID" }, "username"],
    ["label ニックネーム", { name: "f1", label: "ニックネーム" }, "username"],
    ["label アカウント名", { name: "f1", label: "アカウント名" }, "username"],
    ["autocomplete username", { autocomplete: "username" }, "username"],
    ["autocomplete nickname", { autocomplete: "nickname" }, "username"],
    ["user_name with label ユーザー名", { name: "user_name", label: "ユーザー名" }, "username"],
  ]);
});

describe("§2.6 生年月日・年齢・性別", () => {
  table([
    ["birth", { name: "birth" }, "birth"],
    ["birthday", { name: "birthday" }, "birth"],
    ["birthdate", { name: "birthdate" }, "birth"],
    ["birth_date", { name: "birth_date" }, "birth"],
    ["dob", { name: "dob" }, "birth"],
    ["date_of_birth", { name: "date_of_birth" }, "birth"],
    ["seinengappi", { name: "seinengappi" }, "birth"],
    ["label 生年月日", { name: "f1", label: "生年月日" }, "birth"],
    ["label 誕生日", { name: "f1", label: "誕生日" }, "birth"],
    ["type date", { name: "f1", type: "date" }, "birth"],
    ["autocomplete bday", { autocomplete: "bday" }, "birth"],

    ["birth_y", { name: "birth_y" }, "birth_y"],
    ["birth_year", { name: "birth_year" }, "birth_y"],
    ["birthday_yyyy", { name: "birthday_yyyy" }, "birth_y"],
    ["bday_year", { name: "bday_year" }, "birth_y"],
    ["birth1", { name: "birth1" }, "birth_y"],
    ["label 生年月日（年）", { name: "f1", label: "生年月日（年）" }, "birth"],
    ["autocomplete bday-year", { autocomplete: "bday-year" }, "birth_y"],
    ["label 年（和暦）", { name: "f1", label: "年（和暦）" }, "birth_y"],

    ["birth_m", { name: "birth_m" }, "birth_m"],
    ["birth_month", { name: "birth_month" }, "birth_m"],
    ["bday_month", { name: "bday_month" }, "birth_m"],
    ["birth2", { name: "birth2" }, "birth_m"],
    ["autocomplete bday-month", { autocomplete: "bday-month" }, "birth_m"],

    ["birth_d", { name: "birth_d" }, "birth_d"],
    ["birth_day", { name: "birth_day" }, "birth_d"],
    ["bday_day", { name: "bday_day" }, "birth_d"],
    ["birth3", { name: "birth3" }, "birth_d"],
    ["autocomplete bday-day", { autocomplete: "bday-day" }, "birth_d"],

    ["era", { name: "era" }, "era"],
    ["gengo", { name: "gengo" }, "era"],
    ["wareki", { name: "wareki" }, "era"],
    ["nengo", { name: "nengo" }, "era"],
    ["birth_era", { name: "birth_era" }, "era"],
    ["label 元号", { name: "f1", label: "元号" }, "era"],
    ["label 和暦", { name: "f1", label: "和暦" }, "era"],
    [
      "select of eras",
      {
        tag: "select",
        type: "",
        name: "sel",
        options: ["昭和", "平成", "令和"].map((t) => ({ value: t, text: t })),
      },
      "era",
    ],

    ["age", { name: "age" }, "age"],
    ["nenrei", { name: "nenrei" }, "age"],
    ["label 年齢", { name: "f1", label: "年齢" }, "age"],
    ["type number named age", { name: "age", type: "number" }, "age"],

    ["gender", { name: "gender" }, "gender"],
    ["sex", { name: "sex" }, "gender"],
    ["seibetsu", { name: "seibetsu" }, "gender"],
    ["label 性別", { name: "f1", label: "性別" }, "gender"],
    ["autocomplete sex", { autocomplete: "sex" }, "gender"],
    [
      "radio with 男性 / 女性",
      {
        type: "radio",
        name: "q3",
        options: [
          { value: "1", text: "男性" },
          { value: "2", text: "女性" },
        ],
      },
      "gender",
    ],
  ]);

  it("does not treat a lone year field as birth_y", () => {
    expect(one({ name: "year" })).toBe("text");
    expect(one({ name: "f1", label: "年" })).toBe("text");
  });
});

describe("§2.7 会社・肩書", () => {
  table([
    ["company", { name: "company" }, "company"],
    ["company_name", { name: "company_name" }, "company"],
    ["corp", { name: "corp" }, "company"],
    ["corporation", { name: "corporation" }, "company"],
    ["organization", { name: "organization" }, "company"],
    ["org", { name: "org" }, "company"],
    ["kaisha", { name: "kaisha" }, "company"],
    ["kigyo", { name: "kigyo" }, "company"],
    ["hojin", { name: "hojin" }, "company"],
    ["label 会社名", { name: "f1", label: "会社名" }, "company"],
    ["label 企業名", { name: "f1", label: "企業名" }, "company"],
    ["label 法人名", { name: "f1", label: "法人名" }, "company"],
    ["label 団体名", { name: "f1", label: "団体名" }, "company"],
    ["label 貴社名", { name: "f1", label: "貴社名" }, "company"],
    ["label 御社名", { name: "f1", label: "御社名" }, "company"],
    ["autocomplete organization", { autocomplete: "organization" }, "company"],

    ["department", { name: "department" }, "department"],
    ["dept", { name: "dept" }, "department"],
    ["busho", { name: "busho" }, "department"],
    ["division", { name: "division" }, "department"],
    ["section", { name: "section" }, "department"],
    ["label 部署", { name: "f1", label: "部署" }, "department"],
    ["label 部署名", { name: "f1", label: "部署名" }, "department"],
    ["label 所属", { name: "f1", label: "所属" }, "department"],

    ["job_title", { name: "job_title" }, "job_title"],
    ["title", { name: "title" }, "job_title"],
    ["position", { name: "position" }, "job_title"],
    ["yakushoku", { name: "yakushoku" }, "job_title"],
    ["role", { name: "role" }, "job_title"],
    ["label 役職", { name: "f1", label: "役職" }, "job_title"],
    ["label 肩書", { name: "f1", label: "肩書" }, "job_title"],
    ["autocomplete organization-title", { autocomplete: "organization-title" }, "job_title"],

    ["url", { name: "url" }, "url"],
    ["website", { name: "website" }, "url"],
    ["web_site", { name: "web_site" }, "url"],
    ["homepage", { name: "homepage" }, "url"],
    ["hp", { name: "hp" }, "url"],
    ["site", { name: "site" }, "url"],
    ["label URL", { name: "f1", label: "URL" }, "url"],
    ["label ホームページ", { name: "f1", label: "ホームページ" }, "url"],
    ["label サイト", { name: "f1", label: "サイト" }, "url"],
    ["type url", { name: "f1", type: "url" }, "url"],
    ["autocomplete url", { autocomplete: "url" }, "url"],
  ]);

  it("treats a company word next to a name word as the company, not the person", () => {
    expect(one({ name: "company_name" })).toBe("company");
    expect(one({ name: "f1", label: "会社名" })).toBe("company");
  });

  it("does not let the company word swallow the company's phone or address", () => {
    expect(one({ name: "company_tel" })).toBe("tel");
    expect(one({ name: "company_address" })).toBe("address_full");
    expect(one({ name: "company_url" })).toBe("url");
  });
});

describe("§2.8 自由記述・その他", () => {
  table([
    ["textarea", { tag: "textarea", type: "", name: "f1" }, "message"],
    ["message", { name: "message" }, "message"],
    ["comment", { name: "comment" }, "message"],
    ["inquiry", { name: "inquiry" }, "message"],
    ["naiyo", { name: "naiyo" }, "message"],
    ["body", { name: "body" }, "message"],
    ["remarks", { name: "remarks" }, "message"],
    ["bikou", { name: "bikou" }, "message"],
    ["label お問い合わせ内容", { name: "f1", label: "お問い合わせ内容" }, "message"],
    ["label ご要望", { name: "f1", label: "ご要望" }, "message"],
    ["label 備考", { name: "f1", label: "備考" }, "message"],
    ["label コメント", { name: "f1", label: "コメント" }, "message"],
    ["label メッセージ", { name: "f1", label: "メッセージ" }, "message"],

    ["checkbox agree", { type: "checkbox", name: "agree" }, "agree"],
    ["checkbox consent", { type: "checkbox", name: "consent" }, "agree"],
    ["checkbox terms", { type: "checkbox", name: "terms" }, "agree"],
    ["checkbox kiyaku", { type: "checkbox", name: "kiyaku" }, "agree"],
    ["checkbox privacy", { type: "checkbox", name: "privacy" }, "agree"],
    ["checkbox label 同意", { type: "checkbox", name: "c1", label: "利用規約に同意する" }, "agree"],
    ["checkbox label 規約", { type: "checkbox", name: "c1", label: "規約を読みました" }, "agree"],
    ["checkbox label 承諾", { type: "checkbox", name: "c1", label: "承諾" }, "agree"],

    ["type number", { type: "number", name: "qty" }, "number"],
    [
      "unknown select",
      { tag: "select", type: "", name: "job", options: [{ value: "1", text: "会社員" }] },
      "select",
    ],
    [
      "unknown radio",
      { type: "radio", name: "plan", options: [{ value: "a", text: "プランA" }] },
      "radio",
    ],
    [
      "other checkbox",
      { type: "checkbox", name: "newsletter", label: "メールマガジンを受け取る" },
      "checkbox",
    ],
    ["nothing at all", { name: "f1" }, "text"],
    ["label 件名", { name: "f1", label: "件名" }, "text"],
  ]);

  it("does not turn a text field into agree just because the label says 規約", () => {
    expect(one({ name: "f1", label: "規約" })).toBe("text");
  });
});

describe("§2.9 触らない欄", () => {
  table([
    ["hidden", { type: "hidden", name: "email" }, "skip"],
    ["submit", { type: "submit", name: "send" }, "skip"],
    ["button", { type: "button", name: "name" }, "skip"],
    ["reset", { type: "reset" }, "skip"],
    ["image", { type: "image" }, "skip"],
    ["file", { type: "file", name: "photo" }, "skip"],
    ["range", { type: "range", name: "age" }, "skip"],
    ["color", { type: "color" }, "skip"],
    ["search", { type: "search", name: "q" }, "skip"],
    ["csrf", { name: "csrf" }, "skip"],
    ["_token", { name: "_token" }, "skip"],
    ["authenticity_token", { name: "authenticity_token" }, "skip"],
    ["captcha", { name: "captcha" }, "skip"],
    ["g-recaptcha-response", { name: "g-recaptcha-response" }, "skip"],
    ["honeypot", { name: "honeypot" }, "skip"],
    ["nonce", { name: "nonce" }, "skip"],
    ["invisible", { name: "email", visible: false }, "skip"],
  ]);
});

describe("classify (whole form)", () => {
  const f = (over: Partial<FieldInfo>, index: number): FieldInfo => fieldInfo({ ...over, index });

  it("ignores a bare name field when the form has family and given fields", () => {
    const fields = [{ name: "name" }, { name: "sei" }, { name: "mei" }].map(f);
    expect(classify(fields)).toEqual(["skip", "name_family", "name_given"]);
  });

  it("keeps a bare name field when it is the only name", () => {
    const fields = [{ name: "name" }, { name: "email" }].map(f);
    expect(classify(fields)).toEqual(["name_full", "email"]);
  });

  it("makes the second email field the confirmation", () => {
    const fields = [
      { name: "a", type: "email" },
      { name: "b", type: "email" },
    ].map(f);
    expect(classify(fields)).toEqual(["email", "email_confirm"]);
  });

  it("makes the second password field the confirmation", () => {
    const fields = [
      { type: "password", name: "p" },
      { type: "password", name: "q" },
    ].map(f);
    expect(classify(fields)).toEqual(["password", "password_confirm"]);
  });

  it("leaves a third email alone once a confirmation exists", () => {
    const fields = [{ name: "email" }, { name: "email_confirm" }, { name: "email" }].map(f);
    expect(classify(fields)).toEqual(["email", "email_confirm", "email"]);
  });

  it("treats bare year / month / day as birth when all three are present", () => {
    const fields = [{ name: "year" }, { name: "month" }, { name: "day" }].map(f);
    expect(classify(fields)).toEqual(["birth_y", "birth_m", "birth_d"]);
  });

  it("treats 年 / 月 / 日 labels the same way", () => {
    const fields = [
      { name: "a", label: "年" },
      { name: "b", label: "月" },
      { name: "c", label: "日" },
    ].map(f);
    expect(classify(fields)).toEqual(["birth_y", "birth_m", "birth_d"]);
  });

  it("does not guess birth from year and month without a day", () => {
    const fields = [{ name: "year" }, { name: "month" }].map(f);
    expect(classify(fields)).toEqual(["text", "text"]);
  });

  it("classifies the fixture form by name alone", () => {
    const fields = [
      { name: "sei", placeholder: "姓" },
      { name: "mei", placeholder: "名" },
      { name: "sei_kana", placeholder: "セイ" },
      { name: "mei_kana", placeholder: "メイ" },
      { name: "name_kana", placeholder: "やまだ たろう" },
      { name: "zip1", maxlength: 3 },
      { name: "zip2", maxlength: 4 },
      { tag: "select" as const, type: "", name: "pref", options: PREFS },
      { name: "address1" },
      { name: "tel1" },
      { name: "tel2" },
      { name: "tel3" },
      { tag: "select" as const, type: "", name: "birth_era" },
      { name: "birth_y" },
      { name: "birth_m" },
      { name: "birth_d" },
      { name: "email", type: "email" },
    ].map(f);
    expect(classify(fields)).toEqual([
      "name_family",
      "name_given",
      "kana_family",
      "kana_given",
      "kana_full",
      "postal_1",
      "postal_2",
      "prefecture",
      "town",
      "tel_1",
      "tel_2",
      "tel_3",
      "era",
      "birth_y",
      "birth_m",
      "birth_d",
      "email",
    ]);
  });
});

describe("lessons from real forms", () => {
  it("does not take autocomplete=new-password on a text field as a password", () => {
    // Marketo のフォーム。会社名の欄にブラウザの自動入力を止める細工として付いていた。
    expect(
      one({
        name: "stande_accounts__c",
        type: "text",
        autocomplete: "new-password",
        label: "会社名",
      }),
    ).toBe("company");
    expect(one({ name: "pw", type: "password", autocomplete: "new-password" })).toBe("password");
  });

  it("reads 氏 as the family name, as government forms write it", () => {
    expect(one({ id: "input-73", label: "氏" })).toBe("name_family");
    expect(one({ id: "input-79", label: "氏フリガナ" })).toBe("kana_family");
    expect(one({ id: "input-82", label: "名フリガナ" })).toBe("kana_given");
  });

  it("reads （姓） and （名） through the brackets", () => {
    expect(one({ name: "f1", label: "（姓）" })).toBe("name_family");
    expect(one({ name: "f2", label: "（名）" })).toBe("name_given");
  });

  it("lets a placeholder split a whole-name field, as Contact Form 7 forms do", () => {
    expect(one({ name: "your-name", placeholder: "姓", label: "お名前" })).toBe("name_family");
    expect(one({ name: "your-name2", placeholder: "名", label: "お名前" })).toBe("name_given");
    expect(one({ name: "kana", placeholder: "セイ", label: "フリガナ" })).toBe("kana_family");
    expect(one({ name: "kana2", placeholder: "メイ", label: "フリガナ" })).toBe("kana_given");
  });

  it("trusts a placeholder that names the address part over a mislabeled autocomplete", () => {
    // EC-CUBE 4 の addr01 / addr02。
    expect(
      one({
        name: "entry[address][addr01]",
        autocomplete: "address-line1",
        placeholder: "市区町村名(例：大阪市北区)",
      }),
    ).toBe("city");
    expect(
      one({
        name: "entry[address][addr02]",
        autocomplete: "address-line2",
        placeholder: "番地・ビル名(例：西梅田1丁目6-8)",
      }),
    ).toBe("town");
    // 「市区町村・番地」のように両方を言う label では変えない。
    expect(one({ name: "address1", label: "市区町村・番地" })).toBe("town");
  });

  it("treats a Contact Form 7 acceptance box as consent even without the word", () => {
    expect(
      one({
        type: "checkbox",
        name: "acceptance-1",
        label: "営業目的のお問い合わせではありません。",
      }),
    ).toBe("agree");
  });

  it("reads a Japanese name attribute like a label", () => {
    expect(one({ name: "お名前" })).toBe("name_full");
    expect(one({ name: "メールアドレス" })).toBe("email");
    expect(one({ name: "郵便番号" })).toBe("postal");
  });

  it("skips a select whose options are URLs, which would navigate away", () => {
    const archive = [
      { value: "", text: "選択してください" },
      { value: "https://example.jp/archives/2026", text: "2026 年" },
      { value: "https://example.jp/archives/2025", text: "2025 年" },
    ];
    expect(one({ tag: "select", type: "", name: "archive-dropdown", options: archive })).toBe(
      "skip",
    );
    expect(
      one({
        tag: "select",
        type: "",
        name: "lang",
        options: [
          { value: "/ja/", text: "日本語" },
          { value: "/en/", text: "English" },
        ],
      }),
    ).toBe("skip");
  });

  it("still uses the th when the text right before the field is a note", () => {
    // 楽天の会員登録。th「ユーザID」の td に注意書きが並ぶ。collect は両方を label に繋ぐ。
    expect(
      one({
        name: "u",
        label: "<6文字以上・半角英数字> 数字だけにすることはできません 必須ユーザID",
      }),
    ).toBe("username");
  });
});

describe("lessons from Amazon's address form", () => {
  const amazon = (name: string, over: Partial<FieldInfo> = {}) =>
    one({ name: `address-ui-widgets-${name}`, ...over });

  it("reads the country select as a country, not an address", () => {
    expect(amazon("countryCode", { tag: "select", type: "", label: "国/地域" })).toBe("country");
    expect(one({ name: "country" })).toBe("country");
    expect(one({ name: "f1", label: "国" })).toBe("country");
  });

  it("splits the postal code by One / Two", () => {
    expect(amazon("enterAddressPostalCodeOne", { maxlength: 4, placeholder: "例：000" })).toBe(
      "postal_1",
    );
    expect(amazon("enterAddressPostalCodeTwo", { maxlength: 4, placeholder: "例：0000" })).toBe(
      "postal_2",
    );
  });

  it("reads Line1 labeled 市区町村 as the city, and Line2 with a digits-only example as the block", () => {
    expect(
      amazon("enterAddressLine1", { label: "市区町村", placeholder: "例：〇〇市〇〇町" }),
    ).toBe("city");
    expect(
      amazon("enterAddressLine2", {
        label: "丁目・番地・号（数字は半角数字）",
        placeholder: "例：1-2-3",
      }),
    ).toBe("block");
  });

  it("keeps a 番地 field without a digits-only example as the town", () => {
    expect(one({ id: "input-97", label: "番地" })).toBe("town");
    expect(
      one({
        name: "addr02",
        autocomplete: "address-line2",
        placeholder: "番地・ビル名(例：西梅田1丁目6-8)",
      }),
    ).toBe("town");
  });

  it("tells the building name and the room number apart", () => {
    expect(amazon("enterBuildingOrCompanyName", { label: "建物名／会社名・部屋番号" })).toBe(
      "building",
    );
    expect(amazon("enterUnitOrRoomNumber", { label: "建物名／会社名・部屋番号" })).toBe("room");
    expect(one({ name: "f1", label: "部屋番号" })).toBe("room");
    expect(one({ name: "f1", label: "号室" })).toBe("room");
    // 1 つの欄に建物ごと入れるもの。
    expect(one({ id: "input-100", label: "マンション・部屋番号" })).toBe("building");
  });

  it("leaves the full name as one field", () => {
    expect(
      amazon("enterAddressFullName", { autocomplete: "name", label: "氏名（フルネーム）" }),
    ).toBe("name_full");
  });
});

const BRANDS = [
  { value: "", text: "選択してください" },
  { value: "visa", text: "VISA" },
  { value: "master", text: "Mastercard" },
  { value: "jcb", text: "JCB" },
];

describe("§2.10 決済（クレジットカード）", () => {
  table([
    ["name card_number", { name: "card_number" }, "card_number"],
    ["name cardno", { name: "cardno" }, "card_number"],
    ["name cc_number", { name: "cc_number" }, "card_number"],
    ["autocomplete cc-number", { autocomplete: "cc-number" }, "card_number"],
    ["label クレジットカード番号", { name: "f1", label: "クレジットカード番号" }, "card_number"],
    ["card_no1 は 4 分割の 1 つ目", { name: "card_no1" }, "card_1"],
    ["card_no4", { name: "card_no4" }, "card_4"],
    ["name card_holder", { name: "card_holder" }, "card_holder"],
    ["name holder_name", { name: "holder_name" }, "card_holder"],
    ["autocomplete cc-name", { autocomplete: "cc-name" }, "card_holder"],
    [
      "label カード名義（ローマ字）",
      { name: "f1", label: "カード名義（ローマ字）" },
      "card_holder",
    ],
    ["label 名義人", { name: "f1", label: "名義人" }, "card_holder"],
    ["name expiry", { name: "expiry" }, "card_expiry"],
    ["name card_exp", { name: "card_exp" }, "card_expiry"],
    ["autocomplete cc-exp", { autocomplete: "cc-exp" }, "card_expiry"],
    ["type month", { name: "f1", type: "month" }, "card_expiry"],
    ["label 有効期限", { name: "f1", label: "有効期限" }, "card_expiry"],
    ["name exp_month", { name: "exp_month" }, "card_expiry_month"],
    ["name expYear", { name: "expYear" }, "card_expiry_year"],
    ["label 有効期限（月）", { name: "f1", label: "有効期限（月）" }, "card_expiry_month"],
    ["label 有効期限（年）", { name: "f1", label: "有効期限（年）" }, "card_expiry_year"],
    ["autocomplete cc-exp-month", { autocomplete: "cc-exp-month" }, "card_expiry_month"],
    ["name cvc", { name: "cvc" }, "card_cvc"],
    ["name security_code", { name: "security_code" }, "card_cvc"],
    ["autocomplete cc-csc", { autocomplete: "cc-csc" }, "card_cvc"],
    ["label セキュリティコード", { name: "f1", label: "セキュリティコード" }, "card_cvc"],
    [
      "select card_brand",
      { name: "card_brand", tag: "select", type: "", options: BRANDS },
      "card_brand",
    ],
    [
      "radio カード会社",
      { name: "f1", type: "radio", label: "カード会社", options: BRANDS },
      "card_brand",
    ],
    [
      "autocomplete cc-type",
      { autocomplete: "cc-type", tag: "select", type: "", options: BRANDS },
      "card_brand",
    ],
  ]);

  it("does not take a bare cc as a card: mail forms have a CC field", () => {
    expect(one({ name: "cc" })).toBe("text");
    expect(one({ name: "cc", type: "email" })).toBe("email");
  });
});

describe("§2.7 法人番号・インボイス", () => {
  table([
    ["name corporate_number", { name: "corporate_number" }, "corporate_number"],
    ["name houjin_bangou", { name: "houjin_bangou" }, "corporate_number"],
    ["label 法人番号（13桁）", { name: "f1", label: "法人番号（13桁）" }, "corporate_number"],
    ["label 法人名 は会社名のまま", { name: "f1", label: "法人名" }, "company"],
    ["name invoice_number", { name: "invoice_number" }, "invoice_number"],
    [
      "label 適格請求書発行事業者登録番号",
      { name: "f1", label: "適格請求書発行事業者登録番号" },
      "invoice_number",
    ],
    ["label インボイス登録番号", { name: "f1", label: "インボイス登録番号" }, "invoice_number"],
  ]);
});

describe("§2.1 ローマ字", () => {
  table([
    ["name name_en", { name: "name_en" }, "name_romaji"],
    ["name last_name_en", { name: "last_name_en" }, "name_romaji_family"],
    ["name first_name_en", { name: "first_name_en" }, "name_romaji_given"],
    ["name romaji_name", { name: "romaji_name" }, "name_romaji"],
    ["label 氏名（ローマ字）", { name: "f1", label: "氏名（ローマ字）" }, "name_romaji"],
    ["label 姓（英字）", { name: "f1", label: "姓（英字）" }, "name_romaji_family"],
    [
      "autocomplete family-name + ローマ字",
      { autocomplete: "family-name", label: "ローマ字" },
      "name_romaji_family",
    ],
    [
      "name_romaji + placeholder 姓",
      { name: "name_romaji", placeholder: "姓" },
      "name_romaji_family",
    ],
    ["label 半角英字 だけでは何にもならない", { name: "f1", label: "半角英字" }, "text"],
  ]);
});

describe("§2.6 希望日", () => {
  table([
    ["type=date + 配達希望日", { name: "f1", type: "date", label: "配達希望日" }, "date_future"],
    ["type=date + 生年月日 はそのまま", { name: "f1", type: "date", label: "生年月日" }, "birth"],
    ["name delivery_date", { name: "delivery_date" }, "date_future"],
    ["label ご来店希望日", { name: "f1", label: "ご来店希望日" }, "date_future"],
    [
      "select 配達希望日",
      {
        name: "f1",
        tag: "select",
        type: "",
        label: "配達希望日",
        options: [
          { value: "", text: "選択" },
          { value: "2026-09-24", text: "9月24日(木)" },
        ],
      },
      "date_future",
    ],
  ]);
});

describe("placeholder の形（§2.5 / §2.7）", () => {
  table([
    [
      "@username → ユーザー名",
      { name: "s1", label: "Instagram", placeholder: "@username" },
      "username",
    ],
    [
      "https://facebook.com → URL",
      { name: "s2", label: "Facebook", placeholder: "https://facebook.com" },
      "url",
    ],
    [
      "you@example.com → メール",
      { name: "s3", label: "Contact", placeholder: "you@example.com" },
      "email",
    ],
    ["Nickname は語で読めるのでユーザー名", { name: "s5", label: "Nickname" }, "username"],
    ["語に無い英語の label は text", { name: "s5", label: "Favorite color" }, "text"],
    [
      "メールの形でも type が勝つ",
      { name: "s6", type: "url", placeholder: "you@example.com" },
      "url",
    ],
  ]);
});

describe("英語だけの label / placeholder は語で読む", () => {
  table([
    ["Telephone → tel", { name: "s1", label: "Telephone" }, "tel"],
    [
      "Tell us about yourself は電話ではない",
      { name: "s4", tag: "textarea", type: "", placeholder: "Tell us about yourself" },
      "message",
    ],
    ["First Name → 名", { name: "s1", label: "First Name" }, "name_given"],
    ["Last Name → 姓", { name: "s1", label: "Last Name" }, "name_family"],
    ["Zip Code → 郵便番号", { name: "s1", label: "Zip Code" }, "postal"],
    ["Company Name → 会社名", { name: "s1", label: "Company Name" }, "company"],
    ["YYYY/MM/DD の例は年の欄にしない", { name: "birth", placeholder: "YYYY/MM/DD" }, "birth"],
    ["MM/YY の例は月の欄にしない", { name: "expiry", placeholder: "MM/YY" }, "card_expiry"],
    [
      "Choose one は 1 番目ではない",
      {
        name: "s1",
        tag: "select",
        type: "",
        label: "Choose one",
        options: [{ value: "x", text: "X" }],
      },
      "select",
    ],
  ]);
});
