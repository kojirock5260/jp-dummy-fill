import { describe, expect, it } from "vitest";
import { type FieldInfo, fieldInfo } from "../../src/domain/field";
import { homePrefecture, makePlan, planOne } from "../../src/domain/plan";

const TODAY = new Date(2026, 8, 5);
const CENTER = { seed: 0, place: { kind: "center" as const } };

const PREFS = ["選択してください", "北海道", "東京都", "大阪府", "沖縄県"].map((t, i) => ({
  value: i === 0 ? "" : t,
  text: t,
}));

/**
 * 欄の並びから form を作る。
 *
 * @param rows 欄の属性
 * @returns index を振った欄
 */
const form = (rows: Partial<FieldInfo>[]): FieldInfo[] =>
  rows.map((r, i) => fieldInfo({ ...r, index: i }));

/**
 * 計画から name → value の表を作る。
 *
 * @param fields form
 * @param plan makePlan の結果
 * @returns name ごとの値
 */
function byName(
  fields: FieldInfo[],
  plan: ReturnType<typeof makePlan>,
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const e of plan.entries) {
    out[fields[e.index].name] = e.value;
  }
  return out;
}

describe("makePlan", () => {
  it("fills the fixture form consistently from one person", () => {
    const fields = form([
      { name: "sei", placeholder: "姓" },
      { name: "mei", placeholder: "名" },
      { name: "sei_kana", placeholder: "セイ" },
      { name: "mei_kana", placeholder: "メイ" },
      { name: "name_kana", placeholder: "やまだ たろう" },
      { name: "zip1", maxlength: 3 },
      { name: "zip2", maxlength: 4 },
      { tag: "select", type: "", name: "pref", options: PREFS },
      { name: "address1" },
      { name: "tel1", maxlength: 4 },
      { name: "tel2", maxlength: 4 },
      { name: "tel3", maxlength: 4 },
      {
        tag: "select",
        type: "",
        name: "birth_era",
        options: ["昭和", "平成", "令和"].map((t) => ({ value: t, text: t })),
      },
      { name: "birth_y" },
      { name: "birth_m" },
      { name: "birth_d" },
      { name: "email", type: "email" },
    ]);
    const plan = makePlan(fields, CENTER, TODAY);
    const v = byName(fields, plan);
    const p = plan.person;

    expect(v.sei).toBe(p.family);
    expect(v.mei).toBe(p.given);
    expect(v.sei_kana).toMatch(/^[ァ-ヶ]+$/);
    expect(v.mei_kana).toMatch(/^[ァ-ヶ]+$/);
    expect(v.name_kana).toMatch(/^[ぁ-ゖ]+ [ぁ-ゖ]+$/);
    expect(v.zip1).toBe("100");
    expect(v.zip2).toBe("0013");
    expect(v.pref).toBe("東京都");
    // 都道府県の select はあるが市区町村の欄は無いので、市区町村から。建物の欄も無い。
    expect(v.address1).toBe(`千代田区霞が関${p.block} ${p.building}`);
    expect(`${v.tel1}-${v.tel2}-${v.tel3}`).toBe(p.mobile);
    expect(["昭和", "平成", "令和"]).toContain(v.birth_era);
    // 元号の欄があるので年は和暦。
    expect(Number(v.birth_y)).toBeLessThan(100);
    expect(v.birth_m).toBe(String(p.birth.m));
    expect(v.birth_d).toBe(String(p.birth.d));
    expect(v.email).toBe(p.email);
    expect(plan.appendix.endsWith).toBe("霞が関");
  });

  it("uses a prefecture that is already selected", () => {
    const fields = form([
      { tag: "select", type: "", name: "pref", options: PREFS, value: "大阪府", hasValue: true },
      { name: "zip" },
      { name: "city" },
    ]);
    const plan = makePlan(fields, CENTER, TODAY);
    expect(plan.person.address.pref).toBe("大阪府");
    expect(byName(fields, plan).zip).toBe("540-0008");
    expect(byName(fields, plan).city).toBe("大阪市中央区");
  });

  it("reads the selected prefecture off the option text when the value is a code", () => {
    const coded = [
      { value: "", text: "選択" },
      { value: "13", text: "東京都" },
      { value: "47", text: "沖縄県" },
    ];
    const fields = form([
      { tag: "select", type: "", name: "pref", options: coded, value: "47", hasValue: true },
      { name: "zip" },
    ]);
    expect(makePlan(fields, CENTER, TODAY).person.address.pref).toBe("沖縄県");
  });

  it("ignores a prefecture select that is still on its placeholder", () => {
    const fields = form([
      { tag: "select", type: "", name: "pref", options: PREFS, value: "", hasValue: false },
      { name: "zip" },
    ]);
    expect(makePlan(fields, CENTER, TODAY).person.address.pref).toBe("東京都");
  });

  it("changes the address, not the person, for a chosen place", () => {
    const fields = form([{ name: "name" }, { name: "zip" }]);
    const center = makePlan(fields, CENTER, TODAY);
    const sado = makePlan(fields, { seed: 0, place: { kind: "at", zip: "952-1209" } }, TODAY);
    const naha = makePlan(fields, { seed: 0, place: { kind: "at", zip: "900-0021" } }, TODAY);
    expect(byName(fields, sado).name).toBe(byName(fields, center).name);
    expect(byName(fields, naha).name).toBe(byName(fields, center).name);
    expect(byName(fields, sado).zip).toBe("952-1209");
    expect(byName(fields, naha).zip).toBe("900-0021");
    expect(sado.person.address.kind).toBe("island");
    expect(naha.person.address.pref).toBe("沖縄県");
  });

  it("groups unnumbered split fields before rendering", () => {
    const fields = form([
      { name: "zip", label: "郵便番号", maxlength: 3 },
      { name: "zip", maxlength: 4 },
      { name: "tel", label: "電話番号", maxlength: 4 },
      { name: "tel", maxlength: 4 },
      { name: "tel", maxlength: 4 },
    ]);
    const plan = makePlan(fields, CENTER, TODAY);
    expect(plan.entries.map((e) => e.kind)).toEqual([
      "postal_1",
      "postal_2",
      "tel_1",
      "tel_2",
      "tel_3",
    ]);
    expect(plan.entries.map((e) => e.value)).toEqual([
      "100",
      "0013",
      "090",
      ...plan.person.mobile.split("-").slice(1),
    ]);
  });

  it("leaves skipped fields with a null value", () => {
    const fields = form([{ name: "_token", type: "hidden" }, { name: "email" }]);
    const plan = makePlan(fields, CENTER, TODAY);
    expect(plan.entries[0]).toMatchObject({ kind: "skip", value: null });
    expect(plan.entries[1].value).toBe(plan.person.email);
  });
});

describe("planOne", () => {
  it("renders the chosen kind for one field, from the same person as the page", () => {
    const fields = form([
      { name: "sei" },
      { name: "f2", label: "よくわからない欄" },
      { tag: "select", type: "", name: "pref", options: PREFS },
    ]);
    const whole = makePlan(fields, CENTER, TODAY);
    const one = planOne(fields, 1, "kana_family", CENTER, TODAY);
    expect(one.person).toEqual(whole.person);
    expect(one.value).toBe("アベ");
    expect(one.guessed).toBe("text");
  });

  it("shapes the value by the field, like the automatic fill does", () => {
    const fields = form([
      { name: "f1", maxlength: 7 },
      { name: "f2", label: "ふりがな" },
    ]);
    expect(planOne(fields, 0, "postal", CENTER, TODAY).value).toBe("1000013");
    expect(planOne(fields, 1, "kana_full", CENTER, TODAY).value).toMatch(/^[ぁ-ゖ]+　[ぁ-ゖ]+$/);
  });

  it("sees the other fields when composing an address", () => {
    const withCity = form([{ name: "city" }, { name: "f2" }]);
    expect(planOne(withCity, 1, "town", CENTER, TODAY).value).toMatch(
      /^霞が関\d+-\d+-\d+ 霞が関ビル \d0\d$/,
    );
    const alone = form([{ name: "f2" }]);
    expect(planOne(alone, 0, "town", CENTER, TODAY).value).toMatch(/^東京都千代田区霞が関/);
  });

  it("keeps the person's prefecture from a select that is already set", () => {
    const fields = form([
      { tag: "select", type: "", name: "pref", options: PREFS, value: "大阪府", hasValue: true },
      { name: "f2" },
    ]);
    expect(planOne(fields, 1, "postal", CENTER, TODAY).value).toBe("540-0008");
  });

  it("picks an option when the target is a select", () => {
    const fields = form([{ tag: "select", type: "", name: "x", options: PREFS }]);
    expect(planOne(fields, 0, "prefecture", CENTER, TODAY).value).toBe("東京都");
  });
});

describe("homePrefecture", () => {
  const ISLAND = { seed: 0, place: { kind: "at" as const, zip: "907-0012" } };

  it("is the person's own prefecture when nothing is selected", () => {
    const fields = form([{ name: "zip" }, { name: "city" }]);
    expect(homePrefecture(fields, CENTER)).toBe("東京都");
    expect(homePrefecture(fields, CENTER)).toBe(
      makePlan(fields, CENTER, TODAY).person.address.pref,
    );
  });

  it("follows a prefecture that is already selected", () => {
    const fields = form([
      { tag: "select", type: "", name: "pref", options: PREFS, value: "大阪府", hasValue: true },
      { name: "zip" },
    ]);
    expect(homePrefecture(fields, CENTER)).toBe("大阪府");
  });

  it("lets variant.pref override the selected prefecture, so the cycle can come home", () => {
    // 離島が select を沖縄県にしたあと。起点の大阪府へ戻す
    const fields = form([
      { tag: "select", type: "", name: "pref", options: PREFS, value: "沖縄県", hasValue: true },
      { name: "zip" },
      { name: "city" },
    ]);
    const home = { ...CENTER, pref: "大阪府" };
    const plan = makePlan(fields, home, TODAY);
    expect(plan.person.address.pref).toBe("大阪府");
    expect(byName(fields, plan).pref).toBe("大阪府");
    expect(byName(fields, plan).city).toBe("大阪市中央区");
    expect(planOne(fields, 2, "city", home, TODAY).value).toBe("大阪市中央区");
  });

  it("does not let variant.pref pull an island back to the mainland", () => {
    const fields = form([
      { tag: "select", type: "", name: "pref", options: PREFS, value: "大阪府", hasValue: true },
      { name: "zip" },
    ]);
    const island = makePlan(fields, { ...ISLAND, pref: "大阪府" }, TODAY).person.address;
    expect(island.pref).not.toBe("大阪府");
    expect(island).toEqual(makePlan(fields, ISLAND, TODAY).person.address);
  });
});
