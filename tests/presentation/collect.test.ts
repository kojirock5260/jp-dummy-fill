// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { collect, hasValue, precedingText, visible } from "../../src/presentation/collect";

/**
 * jsdom はレイアウトを計算しないので、既定の見え方判定では全部が見えない扱いになる。
 * ここでは「見える」と答えるものを渡し、見え方そのものは最後に別で見る。
 */
const all = () => collect(document, { isVisible: () => true });

/**
 * body を差し替える。
 *
 * @param html body の中身
 */
function mount(html: string): void {
  document.body.innerHTML = html;
}

/**
 * name で 1 欄を取る。
 *
 * @param name 欄の name
 * @returns その欄の FieldInfo
 */
function field(name: string) {
  const hit = all().find((c) => c.info.name === name);
  if (!hit) {
    throw new Error(`no field ${name}`);
  }
  return hit.info;
}

beforeEach(() => {
  mount("");
});

describe("collect / what is collected", () => {
  it("collects inputs, selects and textareas in DOM order with a running index", () => {
    mount('<input name="a"><select name="b"></select><textarea name="c"></textarea>');
    const got = all();
    expect(got.map((c) => c.info.name)).toEqual(["a", "b", "c"]);
    expect(got.map((c) => c.info.index)).toEqual([0, 1, 2]);
    expect(got.map((c) => c.info.tag)).toEqual(["input", "select", "textarea"]);
    expect(got.map((c) => c.info.type)).toEqual(["text", "", ""]);
  });

  it("leaves disabled and readonly fields out", () => {
    mount('<input name="a" disabled><input name="b" readonly><input name="c">');
    expect(all().map((c) => c.info.name)).toEqual(["c"]);
  });

  it("copies the attributes the rules look at", () => {
    mount(
      '<input name="zip" id="z" type="tel" autocomplete="postal-code" inputmode="numeric" pattern="\\d{7}" maxlength="7" placeholder="1000001" aria-label="郵便番号">',
    );
    expect(field("zip")).toMatchObject({
      id: "z",
      type: "tel",
      autocomplete: "postal-code",
      inputmode: "numeric",
      pattern: "\\d{7}",
      maxlength: 7,
      placeholder: "1000001",
      ariaLabel: "郵便番号",
    });
  });

  it("reads maxlength as null when it is not set", () => {
    mount('<input name="a"><textarea name="b"></textarea>');
    expect(field("a").maxlength).toBeNull();
    expect(field("b").maxlength).toBeNull();
  });

  it("reads min and max of a number input", () => {
    mount('<input name="n" type="number" min="1" max="12"><input name="m" type="number">');
    expect(field("n")).toMatchObject({ min: 1, max: 12 });
    expect(field("m")).toMatchObject({ min: null, max: null });
  });

  it("lowercases the input type", () => {
    mount('<input name="e" type="EMAIL">');
    expect(field("e").type).toBe("email");
  });
});

describe("collect / labels", () => {
  it("reads a label linked with for=", () => {
    mount('<label for="x">氏名</label><input id="x" name="n">');
    expect(field("n").label).toBe("氏名");
  });

  it("reads a wrapping label without the control's own text", () => {
    mount(
      '<label>都道府県 <select name="p"><option>北海道</option><option>東京都</option></select></label>',
    );
    expect(field("p").label).toBe("都道府県");
  });

  it("reads aria-labelledby", () => {
    mount('<span id="t">メールアドレス</span><input name="e" aria-labelledby="t">');
    expect(field("e").label).toBe("メールアドレス");
  });

  it("reads the text right before the field", () => {
    mount('<p>電話番号 <input name="t"></p>');
    expect(field("t").label).toBe("電話番号");
  });

  it("walks back over sibling controls and separators to a shared label", () => {
    mount(
      '<label>郵便番号</label><input name="zip1" maxlength="3"> - <input name="zip2" maxlength="4">',
    );
    expect(field("zip1").label).toBe("郵便番号");
    expect(field("zip2").label).toBe("郵便番号");
  });

  it("climbs to a th or dt in the row", () => {
    mount('<table><tr><th>会社名</th><td><input name="c"></td></tr></table>');
    expect(field("c").label).toBe("会社名");
    mount('<dl><dt>部署</dt><dd><input name="d"></dd></dl>');
    expect(field("d").label).toBe("部署");
  });

  it("joins several sources without repeating them", () => {
    mount(
      '<label for="x">氏名</label><label for="x">氏名</label><input id="x" name="n" aria-labelledby="y"><span id="y">必須</span>',
    );
    expect(field("n").label).toBe("氏名 必須");
  });

  it("does not take a long paragraph as a label", () => {
    mount(`<p>${"あ".repeat(80)}</p><input name="n">`);
    expect(field("n").label).toBe("");
  });

  it("stops at the form boundary instead of reading the page heading", () => {
    mount('<h1>お問い合わせ</h1><form><input name="n"></form>');
    expect(field("n").label).toBe("");
  });
});

describe("collect / select", () => {
  it("lists the options with value and text", () => {
    mount(
      '<select name="p"><option value="">選択</option><option value="13">東京都</option></select>',
    );
    expect(field("p").options).toEqual([
      { value: "", text: "選択" },
      { value: "13", text: "東京都" },
    ]);
  });

  it("does not count a placeholder option as a value", () => {
    mount(
      '<select name="p"><option value="">選択してください</option><option>東京都</option></select>',
    );
    expect(field("p").hasValue).toBe(false);
    expect(field("p").value).toBe("");
  });

  it("counts a real selection as a value", () => {
    mount(
      '<select name="p"><option value="">選択</option><option selected>大阪府</option></select>',
    );
    expect(field("p")).toMatchObject({ hasValue: true, value: "大阪府" });
  });
});

describe("collect / radio and checkbox", () => {
  it("folds a radio group into one field with the button labels as options", () => {
    mount(`
      <fieldset><legend>性別</legend>
        <label><input type="radio" name="g" value="m"> 男性</label>
        <label><input type="radio" name="g" value="f"> 女性</label>
      </fieldset>`);
    const got = all();
    expect(got).toHaveLength(1);
    expect(got[0].info).toMatchObject({
      type: "radio",
      name: "g",
      label: "性別",
      options: [
        { value: "m", text: "男性" },
        { value: "f", text: "女性" },
      ],
      checked: false,
      hasValue: false,
    });
    expect(got[0].radios).toHaveLength(2);
  });

  it("reads the option text from the text after an unlabeled radio", () => {
    mount(
      '<p>性別</p><input type="radio" name="g" value="m"> 男性 <input type="radio" name="g" value="f"> 女性',
    );
    expect(field("g").options.map((o) => o.text)).toEqual(["男性", "女性"]);
    expect(field("g").label).toBe("性別");
  });

  it("reports the checked radio as the value", () => {
    mount('<input type="radio" name="g" value="m"><input type="radio" name="g" value="f" checked>');
    expect(field("g")).toMatchObject({ checked: true, hasValue: true, value: "f" });
  });

  it("keeps radios with the same name in different forms apart", () => {
    mount(
      '<form><input type="radio" name="g" value="1"></form><form><input type="radio" name="g" value="2"></form>',
    );
    expect(all()).toHaveLength(2);
  });

  it("reads a checkbox with its label and checked state", () => {
    mount('<label><input type="checkbox" name="agree" checked> 同意する</label>');
    expect(field("agree")).toMatchObject({
      type: "checkbox",
      label: "同意する",
      checked: true,
      hasValue: true,
    });
  });
});

describe("hasValue", () => {
  it("treats whitespace as empty", () => {
    mount('<input name="a" value="  ">');
    expect(hasValue(document.querySelector("input") as HTMLInputElement)).toBe(false);
  });

  it("sees a typed value", () => {
    mount('<input name="a" value="山田">');
    expect(hasValue(document.querySelector("input") as HTMLInputElement)).toBe(true);
  });
});

describe("precedingText", () => {
  it("ignores separators between split fields", () => {
    mount('<span>電話</span><input name="a"> - <input name="b">');
    const b = document.querySelector('[name="b"]') as Element;
    expect(precedingText(b)).toBe("電話");
  });

  it("returns empty when there is nothing before", () => {
    mount('<input name="a">');
    expect(precedingText(document.querySelector("input") as Element)).toBe("");
  });
});

describe("visible", () => {
  it("treats type=hidden as invisible", () => {
    mount('<input type="hidden" name="h">');
    expect(visible(document.querySelector("input") as Element)).toBe(false);
  });

  it("treats an element with no layout boxes as invisible (jsdom has none)", () => {
    mount('<input name="a">');
    expect(visible(document.querySelector("input") as Element)).toBe(false);
  });

  it("is what collect uses by default", () => {
    mount('<input name="a">');
    expect(collect(document)[0].info.visible).toBe(false);
  });
});

describe("collect / label leakage between neighbors", () => {
  it("does not give a labeled checkbox the text of the checkbox before it", () => {
    mount(`
      <label><input type="checkbox" name="agree"> 利用規約に同意する</label>
      <label><input type="checkbox" name="news"> メールマガジンを受け取る</label>`);
    expect(field("agree").label).toBe("利用規約に同意する");
    expect(field("news").label).toBe("メールマガジンを受け取る");
  });

  it("still uses the preceding text for a field without a label of its own", () => {
    mount('<label for="a">氏名</label><input id="a" name="a"><p>電話</p><input name="b">');
    expect(field("a").label).toBe("氏名");
    expect(field("b").label).toBe("電話");
  });

  it("prefers the legend for a radio group and ignores text before the fieldset", () => {
    mount(`<p>お客様情報</p>
      <fieldset><legend>性別</legend>
        <label><input type="radio" name="g" value="m"> 男性</label>
      </fieldset>`);
    expect(field("g").label).toBe("性別");
  });
});

describe("collect / lessons from real forms", () => {
  it("adds the row header even when a note sits right before the field", () => {
    mount(
      '<table><tr><th>必須ユーザID</th><td>&lt;6文字以上・半角英数字&gt; 数字だけにすることはできません<input name="u"></td></tr></table>',
    );
    expect(field("u").label).toContain("必須ユーザID");
    expect(field("u").label).toContain("数字だけにすることはできません");
  });

  it("adds the row header to a labeled field too", () => {
    mount(
      '<table><tr><th>会社名</th><td><label for="c">会社名（正式名称）</label><input id="c" name="c"></td></tr></table>',
    );
    expect(field("c").label).toBe("会社名（正式名称） 会社名");
  });

  it("leaves the site search form alone", () => {
    mount(`
      <form role="search"><input name="q"><select name="category"><option>全て</option></select></form>
      <form><select name="category_id"><option>全て</option></select><input type="search" name="name"></form>
      <form><input name="email"></form>`);
    expect(all().map((c) => c.info.name)).toEqual(["email"]);
  });

  it("treats anything under aria-hidden as invisible", () => {
    mount('<div aria-hidden="true"><input name="a"></div>');
    expect(visible(document.querySelector("input") as Element)).toBe(false);
  });
});
