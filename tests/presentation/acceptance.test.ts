// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { makePlan, type Variant } from "../../src/domain/plan";
import { collect } from "../../src/presentation/collect";
import { writePlan } from "../../src/presentation/write";
import noPrefecture from "../fixtures/jp-form-noprefecture.html?raw";
import main from "../fixtures/jp-form-test.html?raw";
import yubinbango from "../fixtures/jp-form-yubinbango.html?raw";

/**
 * spec §8「受け入れ」。fixtures を jsdom に読み、content.ts と同じ手順で埋める。
 *
 * Chrome で拡張として動かす手前の確認。DOM の読み書きまで含めて、ページ上の値が
 * 期待どおりになることを見る。見え方の判定だけは jsdom にレイアウトが無いので差し替える。
 */

const TODAY = new Date(2026, 8, 5);
const CENTER: Variant = { seed: 0, place: { kind: "center" } };
const now = async (): Promise<void> => {};

/**
 * fixture を読み込んで埋める。
 *
 * @param html fixture の中身
 * @param variant 人物と住所の選び方
 * @param before 埋める前に document に仕掛けをする
 * @returns 書いた欄数と、name → 値 の表
 */
async function run(
  html: string,
  variant: Variant = CENTER,
  before: (doc: Document) => void = () => {},
): Promise<{
  filled: number;
  values: Record<string, string>;
  person: ReturnType<typeof makePlan>["person"];
}> {
  const doc = new DOMParser().parseFromString(html, "text/html");
  // fixture の script（年月日の select を埋める）は DOMParser では走らないので、同じことをする。
  for (const [name, from, to] of [
    ["birth_year", 1950, 2010],
    ["birth_month", 1, 12],
    ["birth_day", 1, 31],
  ] as const) {
    const sel = doc.querySelector<HTMLSelectElement>(`select[name="${name}"]`);
    for (let i = from; sel && i <= to; i++) {
      sel.append(new Option(String(i), String(i)));
    }
  }
  before(doc);

  const collected = collect(doc, { isVisible: () => true });
  const plan = makePlan(
    collected.map((c) => c.info),
    variant,
    TODAY,
  );
  const filled = await writePlan(collected, plan, now);

  const values: Record<string, string> = {};
  for (const el of doc.querySelectorAll<HTMLInputElement>("input, select, textarea")) {
    if (el.type === "checkbox" || el.type === "radio") {
      if (el.checked) {
        values[el.name] = el.value;
      } else {
        values[el.name] ??= "";
      }
    } else {
      values[el.name] = el.value;
    }
  }
  return { filled, values, person: plan.person };
}

describe("acceptance / jp-form-test.html", () => {
  it("writes kana in full-width katakana", async () => {
    const { values } = await run(main);
    expect(values.sei_kana).toMatch(/^[ァ-ヶー]+$/);
    expect(values.mei_kana).toMatch(/^[ァ-ヶー]+$/);
    expect(values.kana1).toMatch(/^[ァ-ヶー]+$/);
    expect(values.kana2).toMatch(/^[ァ-ヶー]+$/);
    expect(values.company_kana).toMatch(/^[ァ-ヶー]+$/);
  });

  it("writes hiragana where the placeholder asks for it", async () => {
    const { values } = await run(main);
    expect(values.name_kana).toMatch(/^[ぁ-ゖ]+ [ぁ-ゖ]+$/);
    expect(values.reading).toMatch(/^[ぁ-ゖ]+　[ぁ-ゖ]+$/);
  });

  it("splits the zip into 3 + 4 and the phone into three", async () => {
    const { values, person } = await run(main);
    expect(values.zip1).toBe("100");
    expect(values.zip2).toBe("0013");
    expect(`${values.tel1}-${values.tel2}-${values.tel3}`).toBe(person.mobile);
    expect(values.tel).toBe(person.mobile);
    expect(values.zip).toBe("1000013");
    expect(values.zipcode).toBe("100-0013");
    expect(values.fax).toBe(person.landline);
  });

  it("selects the prefecture and keeps zip, prefecture and city consistent", async () => {
    const { values, person } = await run(main);
    expect(values.pref).toBe("東京都");
    expect(person.address.zip).toBe("100-0013");
    expect(values.address1).toBe(`千代田区霞が関${person.block} ${person.building}`);
    expect(values.address).toBe(`東京都千代田区霞が関${person.block} ${person.building}`);
  });

  it("writes the address reading down to the town, plus the block", async () => {
    const { values, person } = await run(main);
    expect(values.address_kana).toBe(`トウキョウトチヨダクカスミガセキ${person.block}`);
  });

  it("writes the birth date in the Japanese era where the form has an era select", async () => {
    const { values, person } = await run(main);
    expect(["昭和", "平成", "令和"]).toContain(values.birth_era);
    expect(Number(values.birth_y)).toBeGreaterThan(0);
    expect(Number(values.birth_y)).toBeLessThan(100);
    expect(values.birth_m).toBe(String(person.birth.m));
    expect(values.birth_d).toBe(String(person.birth.d));
    expect(values.birthday).toBe(
      `${person.birth.y}-${String(person.birth.m).padStart(2, "0")}-${String(person.birth.d).padStart(2, "0")}`,
    );
    // 西暦しか並んでいない select には西暦で当てる。
    expect(values.birth_year).toBe(String(person.birth.y));
    expect(values.birth_month).toBe(String(person.birth.m));
    expect(values.birth_day).toBe(String(person.birth.d));
    expect(values.age).toBe(String(person.age));
  });

  it("fills names, contact, company and the rest", async () => {
    const { values, person } = await run(main);
    expect(values.sei).toBe(person.family);
    expect(values.mei).toBe(person.given);
    expect(values.name1).toBe(person.family);
    expect(values.name2).toBe(person.given);
    expect(values.email).toBe(person.email);
    expect(values.email_confirm).toBe(person.email);
    expect(values.password).toBe(person.password);
    expect(values.password_confirm).toBe(person.password);
    expect(values.url).toBe(person.url);
    expect(values.gender).toBe(person.sex);
    expect(values.company).toBe(person.company);
    expect(values.department).toBe(person.department);
    expect(values.message).toMatch(/。/);
  });

  it("turns on the consent box only, and leaves hidden fields alone", async () => {
    const { values } = await run(main);
    expect(values.agree).toBe("on");
    expect(values.newsletter).toBe("");
    expect(values._token).toBe("fixture");
  });

  it("fills every visible field, so nothing is left for the tester", async () => {
    const { values } = await run(main);
    const empty = Object.entries(values)
      .filter(([name]) => name !== "newsletter")
      .filter(([, v]) => v === "")
      .map(([name]) => name);
    expect(empty).toEqual([]);
  });

  it("changes the person and prefecture with the seed", async () => {
    const a = await run(main, { seed: 0, place: { kind: "center" } });
    const b = await run(main, { seed: 1, place: { kind: "center" } });
    expect(b.values.pref).not.toBe(a.values.pref);
    expect(b.values.sei + b.values.mei).not.toBe(a.values.sei + a.values.mei);
    expect(b.values.zip1 + b.values.zip2).toBe(b.person.address.zip.replace("-", ""));
  });

  it("uses a prefecture the tester picked beforehand", async () => {
    const { values, person } = await run(main, CENTER, (doc) => {
      const sel = doc.querySelector<HTMLSelectElement>('select[name="pref"]');
      if (sel) {
        sel.value = "沖縄県";
      }
    });
    expect(person.address.pref).toBe("沖縄県");
    expect(values.zip1 + values.zip2).toBe("9000021");
    expect(values.address1).toContain("那覇市泉崎");
  });
});

describe("acceptance / jp-form-noprefecture.html", () => {
  it("starts 住所1 from the prefecture and puts the building in 住所2", async () => {
    const { values, person } = await run(noPrefecture);
    expect(values.address1).toBe(`東京都千代田区霞が関${person.block}`);
    expect(values.address2).toBe(person.building);
    expect(values.zip).toBe("100-0013");
    expect(values.name).toBe(`${person.family}　${person.given}`);
  });
});

describe("acceptance / jp-form-yubinbango.html", () => {
  /**
   * yubinbango の代わり。郵便番号の change で町域までを埋める。
   *
   * 本物は外部スクリプトなので jsdom では読めない。埋める内容と順序だけを真似る。
   *
   * @param doc fixture の document
   */
  function fakeYubinbango(doc: Document): void {
    const zip = doc.querySelector<HTMLInputElement>(".p-postal-code");
    zip?.addEventListener("change", () => {
      if (zip.value.replace("-", "") !== "1000013") {
        return;
      }
      (doc.querySelector(".p-region") as HTMLInputElement).value = "東京都";
      (doc.querySelector(".p-locality") as HTMLInputElement).value = "千代田区";
      (doc.querySelector(".p-street-address") as HTMLInputElement).value = "霞が関";
    });
  }

  it("lets the autocomplete fill the address and only appends the block", async () => {
    const { values, person, filled } = await run(yubinbango, CENTER, fakeYubinbango);
    expect(values.zip).toBe("100-0013");
    expect(values.pref).toBe("東京都");
    expect(values.city).toBe("千代田区");
    expect(values.address1).toBe(`霞が関${person.block}`);
    expect(values.address2).toBe(person.building);
    // 氏名・郵便番号・建物の 3 つを書き、町域に番地を足した 1 つを数える。
    expect(filled).toBe(4);
  });

  it("fills the whole address itself when there is no autocomplete", async () => {
    const { values, person } = await run(yubinbango);
    expect(values.pref).toBe("東京都");
    expect(values.city).toBe("千代田区");
    expect(values.address1).toBe(`霞が関${person.block}`);
    expect(values.address2).toBe(person.building);
  });
});

describe("acceptance / fill one field by hand", () => {
  it("fixes a field the rules left as plain text, with the same person's value", async () => {
    const { planOne } = await import("../../src/domain/plan");
    const { writeOne } = await import("../../src/presentation/write");
    const doc = new DOMParser().parseFromString(
      `<form>
        <label>氏名</label><input name="sei"> <input name="mei">
        <label>ご担当者様の呼び名</label><input name="q7">
        <label>郵便番号</label><input name="zip">
      </form>`,
      "text/html",
    );
    const collected = collect(doc, { isVisible: () => true });
    const fields = collected.map((c) => c.info);
    const plan = makePlan(fields, CENTER, TODAY);
    await writePlan(collected, plan, now);

    const q7 = doc.querySelector<HTMLInputElement>('[name="q7"]') as HTMLInputElement;
    // 規則は「呼び名」を知らないので短いテキストが入っている。
    expect(q7.value).toBe("テスト入力");

    const at = collected.findIndex((c) => c.el === q7);
    const one = planOne(fields, at, "kana_full", CENTER, TODAY);
    expect(one.guessed).toBe("text");
    expect(writeOne(collected[at], one.value ?? "")).toBe(true);
    // 同じ人物の読みで、名前の欄と一致する。
    expect(q7.value).toBe("アベ　ショウ");
    expect(doc.querySelector<HTMLInputElement>('[name="sei"]')?.value).toBe(plan.person.family);
  });
});
