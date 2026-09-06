// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Plan } from "../../src/domain/plan";
import { collect } from "../../src/presentation/collect";
import {
  AUTOFILL_WAIT_MS,
  check,
  selectOption,
  setValue,
  writeAddress,
  writeOne,
  writePlan,
} from "../../src/presentation/write";

/** 待たずに進む。テストでは 300ms を待つ意味が無い。 */
const now = async (): Promise<void> => {};

/**
 * body を差し替えて集める。
 *
 * @param html body の中身
 * @returns 集めた欄
 */
function mount(html: string) {
  document.body.innerHTML = html;
  return collect(document, { isVisible: () => true });
}

/**
 * 欄の名前 → 値 の表から計画を作る。人物は使わないので最小限。
 *
 * @param collected 集めた欄
 * @param values name ごとの値と欄種
 * @param appendix 番地追記の材料
 * @returns 計画
 */
function planOf(
  collected: ReturnType<typeof collect>,
  values: Record<string, { kind: Plan["entries"][number]["kind"]; value: string | null }>,
  appendix: Plan["appendix"] = { endsWith: "霞が関", add: "1-2-3" },
): Plan {
  return {
    person: {} as Plan["person"],
    appendix,
    entries: collected.map((c) => ({
      index: c.info.index,
      kind: values[c.info.name]?.kind ?? "skip",
      value: values[c.info.name]?.value ?? null,
    })),
  };
}

const input = (name: string): HTMLInputElement =>
  document.querySelector(`[name="${name}"]`) as HTMLInputElement;

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("setValue", () => {
  it("sets the value and fires input, change and blur in that order", () => {
    document.body.innerHTML = '<input name="a">';
    const el = input("a");
    const seen: string[] = [];
    for (const type of ["input", "change", "blur", "keydown", "keyup"]) {
      el.addEventListener(type, () => seen.push(type));
    }
    setValue(el, "山田");
    expect(el.value).toBe("山田");
    expect(seen).toEqual(["input", "change", "blur"]);
  });

  it("bubbles input and change so a listener on the form sees them", () => {
    document.body.innerHTML = '<form><input name="a"></form>';
    const seen: string[] = [];
    (document.querySelector("form") as HTMLFormElement).addEventListener("input", () =>
      seen.push("input"),
    );
    setValue(input("a"), "x");
    expect(seen).toEqual(["input"]);
  });

  it("bypasses a value setter defined on the instance, the way React tracks values", () => {
    document.body.innerHTML = '<input name="a">';
    const el = input("a");
    const native = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    let tracked = "";
    Object.defineProperty(el, "value", {
      configurable: true,
      get() {
        return native?.get?.call(this);
      },
      set(v: string) {
        tracked = v;
        native?.set?.call(this, v);
      },
    });
    setValue(el, "山田");
    expect(el.value).toBe("山田");
    // React が覚えている「最後に自分が入れた値」は古いままなので、変化として拾われる。
    expect(tracked).toBe("");
  });

  it("works on a textarea", () => {
    document.body.innerHTML = '<textarea name="t"></textarea>';
    const el = document.querySelector("textarea") as HTMLTextAreaElement;
    setValue(el, "本文");
    expect(el.value).toBe("本文");
  });
});

describe("selectOption", () => {
  const html =
    '<select name="p"><option value="">選択</option><option value="13">東京都</option><option value="27">大阪府</option></select>';

  it("selects by value", () => {
    document.body.innerHTML = html;
    const el = document.querySelector("select") as HTMLSelectElement;
    expect(selectOption(el, "27")).toBe(true);
    expect(el.value).toBe("27");
  });

  it("falls back to the text, then to a partial match", () => {
    document.body.innerHTML = html;
    const el = document.querySelector("select") as HTMLSelectElement;
    expect(selectOption(el, "東京都")).toBe(true);
    expect(el.value).toBe("13");
    expect(selectOption(el, "大阪")).toBe(true);
    expect(el.value).toBe("27");
  });

  it("reports false and leaves the select alone when nothing matches", () => {
    document.body.innerHTML = html;
    const el = document.querySelector("select") as HTMLSelectElement;
    expect(selectOption(el, "沖縄県")).toBe(false);
    expect(el.value).toBe("");
  });

  it("fires change", () => {
    document.body.innerHTML = html;
    const el = document.querySelector("select") as HTMLSelectElement;
    const onChange = vi.fn();
    el.addEventListener("change", onChange);
    selectOption(el, "13");
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("check", () => {
  it("checks the box and fires change without clicking", () => {
    document.body.innerHTML = '<input type="checkbox" name="c">';
    const el = input("c");
    const onClick = vi.fn();
    const onChange = vi.fn();
    el.addEventListener("click", onClick);
    el.addEventListener("change", onChange);
    check(el);
    expect(el.checked).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("writePlan", () => {
  it("writes every planned value and counts them", async () => {
    const c = mount('<input name="a"><input name="b"><textarea name="t"></textarea>');
    const n = await writePlan(
      c,
      planOf(c, {
        a: { kind: "name_family", value: "山田" },
        b: { kind: "name_given", value: "太郎" },
        t: { kind: "message", value: "本文" },
      }),
      now,
    );
    expect(n).toBe(3);
    expect(input("a").value).toBe("山田");
    expect(input("b").value).toBe("太郎");
    expect((document.querySelector("textarea") as HTMLTextAreaElement).value).toBe("本文");
  });

  it("skips fields that already have a value, and does not count them", async () => {
    const c = mount('<input name="a" value="既存"><input name="b">');
    const n = await writePlan(
      c,
      planOf(c, {
        a: { kind: "name_family", value: "山田" },
        b: { kind: "name_given", value: "太郎" },
      }),
      now,
    );
    expect(n).toBe(1);
    expect(input("a").value).toBe("既存");
  });

  it("skips entries with a null value", async () => {
    const c = mount('<input name="a"><input type="checkbox" name="news">');
    const n = await writePlan(
      c,
      planOf(c, { a: { kind: "text", value: null }, news: { kind: "checkbox", value: null } }),
      now,
    );
    expect(n).toBe(0);
    expect(input("news").checked).toBe(false);
  });

  it("writes the postal code first, waits, then writes the rest", async () => {
    const c = mount('<input name="name"><input name="zip1"><input name="zip2">');
    const order: string[] = [];
    for (const el of document.querySelectorAll("input")) {
      el.addEventListener("input", () => order.push(el.name));
    }
    const wait = vi.fn(async (_ms: number) => {
      order.push("wait");
    });
    await writePlan(
      c,
      planOf(c, {
        name: { kind: "name_full", value: "山田 太郎" },
        zip1: { kind: "postal_1", value: "100" },
        zip2: { kind: "postal_2", value: "0013" },
      }),
      wait,
    );
    expect(order).toEqual(["zip1", "zip2", "wait", "name"]);
    expect(wait).toHaveBeenCalledWith(AUTOFILL_WAIT_MS);
  });

  it("does not wait when there is no postal field", async () => {
    const c = mount('<input name="name">');
    const wait = vi.fn(async () => {});
    await writePlan(c, planOf(c, { name: { kind: "name_full", value: "x" } }), wait);
    expect(wait).not.toHaveBeenCalled();
  });

  it("lets a postal-code autocomplete fill the address, then appends the block once", async () => {
    const c = mount('<input name="zip"><input name="pref"><input name="town">');
    // yubinbango の代わり。郵便番号が入ったら町域までを埋める。
    input("zip").addEventListener("change", () => {
      input("pref").value = "東京都";
      input("town").value = "千代田区霞が関";
    });
    const n = await writePlan(
      c,
      planOf(
        c,
        {
          zip: { kind: "postal", value: "100-0013" },
          pref: { kind: "prefecture", value: "東京都" },
          town: { kind: "town", value: "千代田区霞が関1-2-3 霞が関ビル 403" },
        },
        { endsWith: "霞が関", add: "1-2-3 霞が関ビル 403" },
      ),
      now,
    );
    expect(input("town").value).toBe("千代田区霞が関1-2-3 霞が関ビル 403");
    expect(input("pref").value).toBe("東京都");
    // 郵便番号 1 つと、番地を足した町域 1 つ。補完が埋めた都道府県は数えない。
    expect(n).toBe(2);
  });

  it("does not append to an address the user wrote, or one that already has a block", async () => {
    const c = mount(
      '<input name="a" value="千代田区霞が関1-2-3"><input name="b" value="千代田区永田町">',
    );
    const n = await writePlan(
      c,
      planOf(c, {
        a: { kind: "town", value: "x" },
        b: { kind: "town", value: "x" },
      }),
      now,
    );
    expect(n).toBe(0);
    expect(input("a").value).toBe("千代田区霞が関1-2-3");
    expect(input("b").value).toBe("千代田区永田町");
  });

  it("selects an option, checks a radio by value and turns a checkbox on", async () => {
    const c = mount(`
      <select name="p"><option value="">選択</option><option value="13">東京都</option></select>
      <input type="radio" name="g" value="m"><input type="radio" name="g" value="f">
      <input type="checkbox" name="agree">`);
    const n = await writePlan(
      c,
      planOf(c, {
        p: { kind: "prefecture", value: "13" },
        g: { kind: "gender", value: "f" },
        agree: { kind: "agree", value: "on" },
      }),
      now,
    );
    expect(n).toBe(3);
    expect((document.querySelector("select") as HTMLSelectElement).value).toBe("13");
    expect(input("g").checked).toBe(false);
    expect((document.querySelector('[value="f"]') as HTMLInputElement).checked).toBe(true);
    expect(input("agree").checked).toBe(true);
  });

  it("leaves a radio group alone when one is already checked", async () => {
    const c = mount(
      '<input type="radio" name="g" value="m" checked><input type="radio" name="g" value="f">',
    );
    const n = await writePlan(c, planOf(c, { g: { kind: "gender", value: "f" } }), now);
    expect(n).toBe(0);
    expect(input("g").checked).toBe(true);
  });
});

describe("writeOne", () => {
  it("overwrites an existing value, unlike the automatic fill", () => {
    const c = mount('<input name="a" value="テスト入力">');
    expect(writeOne(c[0], "千代田区")).toBe(true);
    expect(input("a").value).toBe("千代田区");
  });

  it("moves a radio group to the chosen option even when another is checked", () => {
    const c = mount(
      '<input type="radio" name="g" value="m" checked><input type="radio" name="g" value="f">',
    );
    expect(writeOne(c[0], "f")).toBe(true);
    expect(input("g").checked).toBe(false);
    expect((document.querySelector('[value="f"]') as HTMLInputElement).checked).toBe(true);
  });

  it("changes a select that already has a selection", () => {
    const c = mount(
      '<select name="p"><option value="13" selected>東京都</option><option value="27">大阪府</option></select>',
    );
    expect(writeOne(c[0], "27")).toBe(true);
    expect((document.querySelector("select") as HTMLSelectElement).value).toBe("27");
  });

  it("reports false when a radio group has no such option", () => {
    const c = mount('<input type="radio" name="g" value="m">');
    expect(writeOne(c[0], "f")).toBe(false);
  });

  it("fires input and change so the page notices the overwrite", () => {
    const c = mount('<input name="a" value="old">');
    const seen: string[] = [];
    input("a").addEventListener("input", () => seen.push("input"));
    input("a").addEventListener("change", () => seen.push("change"));
    writeOne(c[0], "new");
    expect(seen).toEqual(["input", "change"]);
  });
});

describe("writeAddress", () => {
  it("rewrites the address fields on a filled page and leaves the rest alone", () => {
    const c = mount(
      '<input name="sei" value="阿部"><input name="zip" value="100-0013"><input name="pref" value="東京都"><input name="city" value="千代田区"><input name="email" value="x@example.jp">',
    );
    const n = writeAddress(
      c,
      planOf(c, {
        sei: { kind: "name_family", value: "阿部" },
        zip: { kind: "postal", value: "907-0012" },
        pref: { kind: "prefecture", value: "沖縄県" },
        city: { kind: "city", value: "石垣市" },
        email: { kind: "email", value: "y@example.jp" },
      }),
    );
    expect(n).toBe(3);
    expect(input("zip").value).toBe("907-0012");
    expect(input("pref").value).toBe("沖縄県");
    expect(input("city").value).toBe("石垣市");
    expect(input("sei").value).toBe("阿部");
    expect(input("email").value).toBe("x@example.jp");
  });

  it("writes the postal code before the other address fields", () => {
    const c = mount('<input name="city" value="a"><input name="zip" value="b">');
    const order: string[] = [];
    for (const el of document.querySelectorAll("input")) {
      el.addEventListener("input", () => order.push(el.name));
    }
    writeAddress(
      c,
      planOf(c, {
        city: { kind: "city", value: "石垣市" },
        zip: { kind: "postal", value: "907-0012" },
      }),
    );
    expect(order).toEqual(["zip", "city"]);
  });

  it("includes the fax number, which follows the area code", () => {
    const c = mount(
      '<input name="fax" value="03-1234-5678"><input name="tel" value="090-0000-0000">',
    );
    writeAddress(
      c,
      planOf(c, {
        fax: { kind: "fax", value: "0980-12-3456" },
        tel: { kind: "tel", value: "090-1111-2222" },
      }),
    );
    expect(input("fax").value).toBe("0980-12-3456");
    expect(input("tel").value).toBe("090-0000-0000");
  });
});
