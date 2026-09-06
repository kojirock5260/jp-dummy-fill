// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  closePalette,
  isPaletteOpen,
  openPalette,
  type PaletteGroup,
} from "../../src/presentation/palette";

const GROUPS: PaletteGroup[] = [
  {
    title: "氏名",
    items: [
      { id: "name_family", label: "姓", aliases: ["せい", "みょうじ", "last"] },
      { id: "kana_family", label: "フリガナ（セイ）", aliases: ["ふりがな", "せい", "kana"] },
    ],
  },
  {
    title: "住所",
    items: [
      { id: "city", label: "市区町村", aliases: ["しくちょうそん", "し", "city"] },
      { id: "town", label: "町名・番地", aliases: ["ちょうめい", "ばんち", "town"] },
    ],
  },
];

/**
 * パレットを開いて、中の部品を返す。
 *
 * @param onPick 選ばれたときに呼ぶ
 * @returns 入力欄と行
 */
function open(onPick: (id: string) => void = () => {}) {
  document.body.innerHTML = '<input name="target">';
  const anchor = document.querySelector("input") as HTMLInputElement;
  openPalette({
    anchor,
    groups: GROUPS,
    placeholder: "何を入れる？",
    guess: "自動の判定: 短いテキスト",
    onPick,
  });
  const host = document.documentElement.lastElementChild as HTMLElement;
  const root = host.shadowRoot as ShadowRoot;
  const input = root.querySelector("input") as HTMLInputElement;
  const rows = () =>
    [...root.querySelectorAll<HTMLLIElement>("li.item")]
      .filter((li) => !li.hidden)
      .map((li) => li.dataset.id);
  const selected = () => root.querySelector<HTMLLIElement>("li.item.on")?.dataset.id;
  const headings = () =>
    [...root.querySelectorAll<HTMLLIElement>("li.grp")]
      .filter((li) => !li.hidden)
      .map((li) => li.textContent);
  const type = (text: string) => {
    input.value = text;
    input.dispatchEvent(new Event("input"));
  };
  const press = (key: string) =>
    input.dispatchEvent(new KeyboardEvent("keydown", { key, cancelable: true }));
  return { host, root, input, rows, selected, headings, type, press };
}

afterEach(() => {
  closePalette();
  document.body.innerHTML = "";
});

describe("openPalette", () => {
  it("lists every kind under its heading and shows the guess", () => {
    const p = open();
    expect(isPaletteOpen()).toBe(true);
    expect(p.rows()).toEqual(["name_family", "kana_family", "city", "town"]);
    expect(p.headings()).toEqual(["氏名", "住所"]);
    expect(p.root.querySelector(".guess")?.textContent).toBe("自動の判定: 短いテキスト");
    expect(p.selected()).toBe("name_family");
  });

  it("filters by the reading as you type, folding hiragana into katakana", () => {
    const p = open();
    p.type("しく");
    expect(p.rows()).toEqual(["city"]);
    expect(p.headings()).toEqual(["住所"]);
    // 「せい」は 姓 の読みでもあり、フリガナ（セイ）の表示名にも含まれる。
    p.type("せい");
    expect(p.rows()).toEqual(["name_family", "kana_family"]);
    p.type("セイ");
    expect(p.rows()).toEqual(["name_family", "kana_family"]);
    p.type("みょうじ");
    expect(p.rows()).toEqual(["name_family"]);
  });

  it("filters by heading and by kind id too", () => {
    const p = open();
    p.type("住所");
    expect(p.rows()).toEqual(["city", "town"]);
    p.type("last");
    expect(p.rows()).toEqual(["name_family"]);
  });

  it("shows a placeholder row when nothing matches", () => {
    const p = open();
    p.type("zzz");
    expect(p.rows()).toEqual([]);
    expect(p.root.querySelector<HTMLLIElement>("li.none")?.hidden).toBe(false);
  });

  it("moves the selection with the arrow keys and wraps", () => {
    const p = open();
    p.press("ArrowDown");
    expect(p.selected()).toBe("kana_family");
    p.press("ArrowUp");
    p.press("ArrowUp");
    expect(p.selected()).toBe("town");
  });

  it("picks the selected row on Enter, closing first", () => {
    const seen: string[] = [];
    const p = open((kind) => {
      seen.push(kind);
      expect(isPaletteOpen()).toBe(false);
    });
    p.type("町名");
    p.press("Enter");
    expect(seen).toEqual(["town"]);
    expect(document.documentElement.contains(p.host)).toBe(false);
  });

  it("picks a row on click", () => {
    const onPick = vi.fn();
    const p = open(onPick);
    (p.root.querySelector('li[data-id="city"]') as HTMLElement).click();
    expect(onPick).toHaveBeenCalledWith("city");
    expect(isPaletteOpen()).toBe(false);
  });

  it("closes on Escape without picking", () => {
    const onPick = vi.fn();
    const p = open(onPick);
    p.press("Escape");
    expect(onPick).not.toHaveBeenCalled();
    expect(isPaletteOpen()).toBe(false);
  });

  it("closes when the page is clicked outside the palette", () => {
    open();
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(isPaletteOpen()).toBe(false);
  });

  it("keeps Enter and Escape away from the page", () => {
    const p = open();
    const enter = new KeyboardEvent("keydown", { key: "Enter", cancelable: true, bubbles: true });
    p.input.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
  });

  it("replaces an open palette instead of stacking a second one", () => {
    open();
    open();
    expect(document.querySelectorAll("html > div").length).toBe(1);
  });
});

describe("openPalette / recall a person by number", () => {
  /**
   * 呼び出しの行を付けて開く。
   *
   * @param onRecall 番号が確定したときに呼ぶ
   * @returns 入力欄と行
   */
  function openWithRecall(onRecall: (seed: number) => void) {
    document.body.innerHTML = '<input name="target">';
    const anchor = document.querySelector("input") as HTMLInputElement;
    openPalette({
      anchor,
      groups: GROUPS,
      placeholder: "何を入れる？",
      guess: "",
      recall: {
        label: "人物を番号で呼び出す…",
        placeholder: "番号",
        aliases: ["ばんごう", "no"],
        onRecall,
      },
      onPick: () => {},
    });
    const host = document.documentElement.lastElementChild as HTMLElement;
    const root = host.shadowRoot as ShadowRoot;
    const input = root.querySelector("input") as HTMLInputElement;
    const rows = () =>
      [...root.querySelectorAll<HTMLLIElement>("li.item")]
        .filter((li) => !li.hidden)
        .map((li) => li.dataset.id ?? li.dataset.action);
    const type = (text: string) => {
      input.value = text;
      input.dispatchEvent(new Event("input"));
    };
    const press = (key: string) =>
      input.dispatchEvent(new KeyboardEvent("keydown", { key, cancelable: true }));
    return { root, input, rows, type, press };
  }

  it("lists the recall row last and finds it by its reading", () => {
    const p = openWithRecall(() => {});
    const listed = p.rows();
    expect(listed[listed.length - 1]).toBe("recall");
    p.type("ばんごう");
    expect(p.rows()).toEqual(["recall"]);
  });

  it("shows only the recall row when digits are typed, and recalls on Enter", () => {
    const seen: number[] = [];
    const p = openWithRecall((n) => seen.push(n));
    p.type("4213");
    expect(p.rows()).toEqual(["recall"]);
    p.press("Enter");
    expect(seen).toEqual([4213]);
    expect(isPaletteOpen()).toBe(false);
  });

  it("switches to a number prompt when the row is chosen with no digits typed", () => {
    const seen: number[] = [];
    const p = openWithRecall((n) => seen.push(n));
    p.type("ばんごう");
    p.press("Enter");
    expect(isPaletteOpen()).toBe(true);
    expect(p.input.value).toBe("");
    expect(p.input.placeholder).toBe("番号");
    expect((p.root.querySelector("ul") as HTMLUListElement).hidden).toBe(true);
    p.type("１２");
    p.press("Enter");
    expect(seen).toEqual([12]);
  });

  it("ignores Enter on a non-number while waiting for one", () => {
    const seen: number[] = [];
    const p = openWithRecall((n) => seen.push(n));
    p.type("ばんごう");
    p.press("Enter");
    p.type("abc");
    p.press("Enter");
    expect(seen).toEqual([]);
    expect(isPaletteOpen()).toBe(true);
    p.press("Escape");
    expect(isPaletteOpen()).toBe(false);
  });

  it("does not let digits pick postal_1 by its id", () => {
    const p = openWithRecall(() => {});
    p.type("1");
    expect(p.rows()).toEqual(["recall"]);
  });
});
