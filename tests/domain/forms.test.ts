import { describe, expect, it } from "vitest";
import { classify } from "../../src/domain/classify";
import {
  type FieldInfo,
  type FieldKind,
  type FieldOption,
  fieldInfo,
} from "../../src/domain/field";
import { group } from "../../src/domain/group";
import { makePlan } from "../../src/domain/plan";

/**
 * 実サイトのフォームから抜き出した欄の並びで、判定を固定する。
 *
 * `tests/fixtures/forms/*.json` は、実ブラウザで各ページの input / select / textarea の
 * 属性と周りの文字（label、th、直前のテキスト）を抜いたもの。値は取っていない。
 * ここでは collect と同じ規則で FieldInfo に組み立て、classify → group に通して、
 * 手で確かめた欄種と突き合わせる。
 *
 * 見え方（visible）は考えない。判定だけを見たいので全部見えているものとして扱う。
 */

type RawField = {
  tag: "input" | "select" | "textarea";
  type?: string;
  name?: string;
  id?: string;
  autocomplete?: string;
  inputmode?: string;
  pattern?: string;
  maxlength?: number;
  placeholder?: string;
  ariaLabel?: string;
  labelledby?: string;
  labels?: string;
  wrap?: string;
  prev?: string;
  next?: string;
  th?: string;
  legend?: string;
  options?: FieldOption[];
  value?: string;
  readonly?: boolean;
  disabled?: boolean;
  searchForm?: boolean;
};

type Capture = { url: string; title: string; fields: RawField[] };

const captures = import.meta.glob("../fixtures/forms/*.json", {
  eager: true,
  import: "default",
}) as Record<string, Capture>;

/**
 * 空を除いて空白で繋ぐ。collect の join と同じ。
 *
 * @param parts 繋ぐ文字列
 * @returns 繋いだ文字列
 */
const join = (...parts: (string | undefined)[]): string =>
  [...new Set(parts.map((p) => (p ?? "").trim()).filter((p) => p !== ""))].join(" ");

/**
 * 抜き出した欄を、collect が作るのと同じ形の FieldInfo にする。
 *
 * radio は name ごとに 1 つに束ね、各ボタンの label を選択肢にする。
 * readonly / disabled / 検索フォームの欄は collect と同じく落とす。
 *
 * @param raw 抜き出した欄
 * @returns FieldInfo と、期待値を引くための鍵
 */
function toFields(raw: RawField[]): { info: FieldInfo; key: string }[] {
  const out: { info: FieldInfo; key: string }[] = [];
  const radios = new Map<string, number>();

  for (const [i, f] of raw.entries()) {
    if (f.readonly || f.disabled || f.searchForm) {
      continue;
    }
    const key = f.name || f.id || `#${i}`;
    if (f.type === "radio") {
      const option = { value: f.value ?? "", text: f.labels || f.wrap || f.next || f.value || "" };
      const at = radios.get(key);
      if (at !== undefined) {
        out[at].info.options.push(option);
        continue;
      }
      radios.set(key, out.length);
      out.push({
        key,
        info: fieldInfo({
          index: out.length,
          tag: "input",
          type: "radio",
          name: f.name ?? "",
          id: f.id ?? "",
          label: join(f.legend, f.labelledby, f.th, f.legend ? "" : f.prev),
          options: [option],
        }),
      });
      continue;
    }
    const own = join(f.labels, f.labelledby);
    out.push({
      key,
      info: fieldInfo({
        index: out.length,
        tag: f.tag,
        type: f.tag === "input" ? (f.type ?? "text") : "",
        name: f.name ?? "",
        id: f.id ?? "",
        autocomplete: f.autocomplete ?? "",
        inputmode: f.inputmode ?? "",
        pattern: f.pattern ?? "",
        maxlength: f.maxlength ?? null,
        placeholder: f.placeholder ?? "",
        ariaLabel: f.ariaLabel ?? "",
        label: join(own !== "" ? own : f.prev, f.th),
        options: f.options ?? [],
      }),
    });
  }
  return out;
}

/**
 * 1 つの取得ファイルを判定する。
 *
 * @param file ファイル名（拡張子なし）
 * @returns 鍵 → 欄種 と、計画に使う FieldInfo
 */
function run(file: string): { kinds: Record<string, FieldKind>; fields: FieldInfo[] } {
  const capture = Object.entries(captures).find(([path]) => path.endsWith(`/${file}.json`))?.[1];
  if (!capture) {
    throw new Error(`no capture ${file}`);
  }
  const converted = toFields(capture.fields);
  const fields = converted.map((c) => c.info);
  const kinds = group(fields, classify(fields));
  const byKey: Record<string, FieldKind> = {};
  converted.forEach((c, i) => {
    byKey[c.key] = kinds[i];
  });
  return { kinds: byKey, fields };
}

/**
 * 計画から鍵 → 値 の表を作る。
 *
 * @param file ファイル名
 * @returns 鍵ごとの値
 */
function values(file: string): Record<string, string | null> {
  const capture = Object.entries(captures).find(([path]) => path.endsWith(`/${file}.json`))?.[1];
  const converted = toFields(capture?.fields ?? []);
  const plan = makePlan(
    converted.map((c) => c.info),
    { seed: 0, place: { kind: "center" } },
    new Date(2026, 8, 5),
  );
  const out: Record<string, string | null> = {};
  plan.entries.forEach((e, i) => {
    out[converted[i].key] = e.value;
  });
  return out;
}

/** 手で確かめた欄種。ここに無い欄は見ていない。 */
const EXPECTED: Record<string, Record<string, FieldKind>> = {
  "rakuten-register": {
    email: "email",
    email2: "email_confirm",
    radio_mail: "radio",
    u: "username",
    p: "password",
    lname: "name_family",
    fname: "name_given",
    lname_kana: "kana_family",
    fname_kana: "kana_given",
    execMethod: "skip",
  },
  "eccube4-entry": {
    "entry[name][name01]": "name_family",
    "entry[name][name02]": "name_given",
    "entry[kana][kana01]": "kana_family",
    "entry[kana][kana02]": "kana_given",
    "entry[company_name]": "company",
    "entry[postal_code]": "postal",
    "entry[address][pref]": "prefecture",
    "entry[address][addr01]": "city",
    "entry[address][addr02]": "town",
    "entry[phone_number]": "tel",
    "entry[email][first]": "email",
    "entry[email][second]": "email_confirm",
    "entry[plain_password][first]": "password",
    "entry[plain_password][second]": "password_confirm",
    "entry[birth][year]": "birth_y",
    "entry[birth][month]": "birth_m",
    "entry[birth][day]": "birth_d",
    "entry[sex]": "gender",
    "entry[job]": "select",
    "entry[user_policy_check]": "agree",
  },
  "logoform-application": {
    "input-73": "name_family",
    "input-76": "name_given",
    "input-79": "kana_family",
    "input-82": "kana_given",
    "input-85": "postal",
    "input-94": "city",
    "input-97": "town",
    "input-100": "building",
    "input-103": "email",
    "input-106": "email_confirm",
    "radio-109": "gender",
    "input-117": "birth",
    "radio-132": "radio",
  },
  "google-forms-register": {
    "#1": "kana_full",
    "#2": "email",
    "#3": "tel",
  },
  "smarthr-contact": {
    LastName: "name_family",
    FirstName: "name_given",
    stande_accounts__c: "company",
    Email: "email",
    Phone: "tel",
    NumberOfEmployees: "select",
    Job_category2__c: "select",
    Title_class__c: "job_title",
    PMCFStringMultipurpose01: "checkbox",
    contact_body_del__c: "message",
    contact_detail__c: "message",
    flug_inuse_contact__c: "checkbox",
    trigger_SmartHR__c: "checkbox",
    PrivacyPolicyAgreement__c: "agree",
  },
  "olein-snowmonkey-contact": {
    name: "name_full",
    mail: "email",
    "type[]": "checkbox",
    message: "message",
  },
  "amazon-address": {
    "address-ui-widgets-countryCode": "country",
    "address-ui-widgets-enterAddressFullName": "name_full",
    "address-ui-widgets-enterAddressPhoneNumber": "tel",
    "address-ui-widgets-enterAddressPostalCodeOne": "postal_1",
    "address-ui-widgets-enterAddressPostalCodeTwo": "postal_2",
    "address-ui-widgets-enterAddressStateOrRegion": "prefecture",
    "address-ui-widgets-enterAddressLine1": "city",
    "address-ui-widgets-enterAddressLine2": "block",
    "address-ui-widgets-enterBuildingOrCompanyName": "building",
    "address-ui-widgets-enterUnitOrRoomNumber": "room",
    "address-ui-widgets-use-as-my-default": "checkbox",
  },
  "webroad-cf7-contact": {
    s: "skip",
    "acceptance-1": "agree",
    "url-hp": "url",
    kikkake: "radio",
    menu: "message",
    "yosan[]": "checkbox",
    "your-message": "message",
    "your-name": "name_family",
    "your-name2": "name_given",
    kana: "kana_family",
    kana2: "kana_given",
    "your-email": "email",
    company: "company",
    tel: "tel",
    "acceptance-3": "agree",
    "archive-dropdown": "skip",
    "g-recaptcha-response": "skip",
  },
};

describe("real forms / classification", () => {
  for (const [file, expected] of Object.entries(EXPECTED)) {
    describe(file, () => {
      const { kinds } = run(file);
      for (const [key, kind] of Object.entries(expected)) {
        it(`${key} → ${kind}`, () => {
          expect(kinds[key], key).toBe(kind);
        });
      }
    });
  }

  it("covers every capture file", () => {
    const files = Object.keys(captures).map((p) => p.replace(/^.*\/|\.json$/g, ""));
    expect(files.sort()).toEqual(Object.keys(EXPECTED).sort());
  });
});

describe("real forms / values", () => {
  it("EC-CUBE 4: zip and phone without hyphens, city / town / building split its way", () => {
    const v = values("eccube4-entry");
    expect(v["entry[postal_code]"]).toBe("1000013");
    expect(v["entry[phone_number]"]).toMatch(/^090\d{8}$/);
    expect(v["entry[address][pref]"]).toBe("13");
    expect(v["entry[address][addr01]"]).toBe("千代田区");
    expect(v["entry[address][addr02]"]).toMatch(/^霞が関\d+-\d+-\d+ 霞が関ビル \d0\d$/);
    expect(v["entry[birth][month]"]).toMatch(/^\d+$/);
    expect(v["entry[sex]"]).toBe("1");
    expect(v["entry[job]"]).toBe("1");
  });

  it("Contact Form 7: split name by placeholder, phone without hyphens, consent boxes on", () => {
    const v = values("webroad-cf7-contact");
    expect(v["your-name"]).toBe("阿部");
    expect(v["your-name2"]).toBe("翔");
    expect(v.kana).toBe("アベ");
    expect(v.kana2).toBe("ショウ");
    expect(v.tel).toMatch(/^090\d{8}$/);
    expect(v["acceptance-1"]).toBe("on");
    expect(v.menu).toBe("ホームページの新規制作・リニューアルを依頼したい");
    expect(v["archive-dropdown"]).toBeNull();
  });

  it("Marketo: company stays a company despite autocomplete=new-password, selects get an option", () => {
    const v = values("smarthr-contact");
    expect(v.stande_accounts__c).toBe("阿部商事株式会社");
    expect(v.contact_body_del__c).toBe("導入について");
    expect(v.Title_class__c).toBe("課長クラス");
    expect(v.Phone).toBe("090-0947-6865");
    expect(v.PMCFStringMultipurpose01).toBeNull();
    expect(v.PrivacyPolicyAgreement__c).toBe("on");
  });

  it("LoGoフォーム: 氏 / 名 by label alone, birth date with hyphens as the aria-label asks", () => {
    const v = values("logoform-application");
    expect(v["input-73"]).toBe("阿部");
    expect(v["input-79"]).toBe("アベ");
    expect(v["input-117"]).toBe("1984-07-18");
    expect(v["radio-109"]).toBe("男性");
    expect(v["input-97"]).toMatch(/^霞が関\d+-\d+-\d+$/);
    expect(v["input-100"]).toMatch(/ビル/);
  });

  it("Google Forms: katakana full name from the question text", () => {
    const v = values("google-forms-register");
    expect(v["#1"]).toBe("アベ　ショウ");
    expect(v["#2"]).toBe("shou.abe.0@example.jp");
    expect(v["#3"]).toBe("090-0947-6865");
  });

  it("Amazon: city with town, block alone, building and room apart, country untouched", () => {
    const v = values("amazon-address");
    expect(v["address-ui-widgets-countryCode"]).toBe("JP");
    expect(v["address-ui-widgets-enterAddressFullName"]).toBe("阿部　翔");
    expect(v["address-ui-widgets-enterAddressPhoneNumber"]).toBe("090-0947-6865");
    expect(v["address-ui-widgets-enterAddressPostalCodeOne"]).toBe("100");
    expect(v["address-ui-widgets-enterAddressPostalCodeTwo"]).toBe("0013");
    expect(v["address-ui-widgets-enterAddressStateOrRegion"]).toBe("東京都");
    expect(v["address-ui-widgets-enterAddressLine1"]).toBe("千代田区霞が関");
    expect(v["address-ui-widgets-enterAddressLine2"]).toMatch(/^\d+-\d+-\d+$/);
    expect(v["address-ui-widgets-enterBuildingOrCompanyName"]).toBe("霞が関ビル");
    expect(v["address-ui-widgets-enterUnitOrRoomNumber"]).toMatch(/^\d0\d$/);
    expect(v["address-ui-widgets-use-as-my-default"]).toBeNull();
  });

  it("Rakuten: username from the th, confirmation email by number", () => {
    const v = values("rakuten-register");
    expect(v.u).toBe("abe_shou_0");
    expect(v.email2).toBe(v.email);
    expect(v.lname_kana).toBe("アベ");
  });
});
