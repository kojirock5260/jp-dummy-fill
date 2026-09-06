import { hiraToKata } from "../domain/kana";
import css from "./palette.css?raw";

/**
 * 一覧から 1 つ選ぶパレット。「この欄にデータを埋める」では欄種を、
 * 「住所を遠隔地・離島に替える」では場所を並べる。欄のそばに開く。
 *
 * 右クリックメニューに欄種を並べると 4 段になり、探して辿るだけで用が済まなくなる。
 * 代わりに小さな入力欄を出し、「しく」と打てば「市区町村」が残る形にした。
 * 打って Enter の 2 手で入る。
 *
 * 末尾に「人物を番号で呼び出す…」の行がある。選ぶと入力欄が番号待ちになり、番号を
 * 打って Enter でその人物に切り替わる。最初から数字を打った場合も同じ扱い。
 *
 * ページの CSS に影響されないよう Shadow DOM に入れる。ページ側には何も残さない。
 * 開いているのは一度に 1 つで、開き直せば前のものは閉じる。
 */

export type PaletteItem = {
  /** 選ばれたときに返す印。欄種の名前や郵便番号 */
  id: string;
  label: string;
  /** 絞り込みに使う読み。表示名が漢字なので、「しく」で「市区町村」を残すのに要る */
  aliases?: readonly string[];
};

/** 見出しと、その下の行。見出しが空なら行だけを並べる。 */
export type PaletteGroup = { title: string; items: PaletteItem[] };

/** 「人物を番号で呼び出す…」の行。 */
export type PaletteRecall = {
  label: string;
  /** 番号待ちになったときの placeholder。「番号（例：4213）」 */
  placeholder: string;
  aliases?: readonly string[];
  /** 番号が確定したときに呼ぶ。呼ぶ前にパレットは閉じている */
  onRecall: (seed: number) => void;
};

export type PaletteOptions = {
  /** そばに出す欄。 */
  anchor: Element;
  /** 並べる欄種。見出しごと */
  groups: readonly PaletteGroup[];
  /** 入力欄の placeholder。 */
  placeholder: string;
  /** 「自動の判定: 短いテキスト」。無ければ空 */
  guess: string;
  /** 番号で人物を呼び出す行。無ければ出さない */
  recall?: PaletteRecall;
  /** 選ばれたときに、その行の id を渡して呼ぶ。呼ぶ前にパレットは閉じている */
  onPick: (id: string) => void;
};

/** 行が起こすこと。選んだ印を返すか、番号待ちに入るか。 */
type Action = { type: "item"; id: string } | { type: "recall" };

/** 一覧の 1 行。照合用に整えた文字を持っておく。 */
type Row = { el: HTMLLIElement; text: string; group: string; action: Action };

type Session = {
  host: HTMLElement;
  input: HTMLInputElement;
  list: HTMLUListElement;
  guess: HTMLElement | null;
  rows: Row[];
  headings: HTMLLIElement[];
  none: HTMLLIElement;
  visible: Row[];
  selected: number;
  /** `recall` は番号待ち。一覧は隠れ、Enter が番号の確定になる */
  mode: "search" | "recall";
  recall: PaletteRecall | null;
  onPick: (id: string) => void;
  close: () => void;
};

/** 開いているパレット。「無いかもしれない」のはこの変数だけ。 */
let session: Session | null = null;

/** パレットの大きさの見込み（CSS と同じ）。上に出すか下に出すかの判断に使う。 */
const PANEL_HEIGHT = 340;
const PANEL_WIDTH = 280;

/**
 * パレットを開く。開いていれば閉じてから開き直す。
 *
 * @param opts 並べる欄種と、選ばれたときの動き
 */
export function openPalette(opts: PaletteOptions): void {
  closePalette();

  const host = document.createElement("div");
  host.style.cssText = "all:initial;position:fixed;left:0;top:0;z-index:2147483647;";
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = css;

  const panel = document.createElement("div");
  panel.className = "panel";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = opts.placeholder;
  input.setAttribute("aria-label", opts.placeholder);

  const list = document.createElement("ul");
  const rows: Row[] = [];
  const headings: HTMLLIElement[] = [];
  for (const g of opts.groups) {
    if (g.title !== "") {
      const heading = document.createElement("li");
      heading.className = "grp";
      heading.textContent = g.title;
      list.append(heading);
      headings.push(heading);
    }
    for (const item of g.items) {
      const li = document.createElement("li");
      li.className = "item";
      li.textContent = item.label;
      li.dataset.id = item.id;
      list.append(li);
      rows.push({
        el: li,
        text: normalize([item.label, ...(item.aliases ?? [])].join(" ")),
        group: normalize(g.title),
        action: { type: "item", id: item.id },
      });
    }
  }
  if (opts.recall) {
    const li = document.createElement("li");
    li.className = "item recall";
    li.textContent = opts.recall.label;
    li.dataset.action = "recall";
    list.append(li);
    rows.push({
      el: li,
      text: normalize([opts.recall.label, ...(opts.recall.aliases ?? [])].join(" ")),
      group: "",
      action: { type: "recall" },
    });
  }
  const none = document.createElement("li");
  none.className = "none";
  none.textContent = "—";
  none.hidden = true;
  list.append(none);

  panel.append(input);
  let guess: HTMLElement | null = null;
  if (opts.guess !== "") {
    guess = document.createElement("div");
    guess.className = "guess";
    guess.textContent = opts.guess;
    panel.append(guess);
  }
  panel.append(list);
  shadow.append(style, panel);

  // 下で作る s を掴むだけの包み。剥がすときに同じ参照が要るので変数に取る。
  const onKey = (e: KeyboardEvent): void => key(s, e);
  const onInput = (): void => {
    if (s.mode === "search") {
      filter(s, input.value);
    }
  };
  const onClick = (e: MouseEvent): void => {
    const li = (e.target as Element | null)?.closest<HTMLLIElement>("li.item");
    const row = li ? rows.find((r) => r.el === li) : undefined;
    if (row) {
      pick(s, row);
    }
  };
  // 外を押したら閉じる。Shadow DOM の中の要素は composedPath で見る。
  const onOutside = (e: PointerEvent): void => {
    if (!e.composedPath().includes(host)) {
      closePalette();
    }
  };

  const s: Session = {
    host,
    input,
    list,
    guess,
    rows,
    headings,
    none,
    visible: rows,
    selected: 0,
    mode: "search",
    recall: opts.recall ?? null,
    onPick: opts.onPick,
    close: () => {
      input.removeEventListener("keydown", onKey);
      input.removeEventListener("input", onInput);
      list.removeEventListener("click", onClick);
      document.removeEventListener("pointerdown", onOutside, true);
      host.remove();
    },
  };

  input.addEventListener("keydown", onKey);
  input.addEventListener("input", onInput);
  list.addEventListener("click", onClick);
  document.addEventListener("pointerdown", onOutside, true);

  place(panel, opts.anchor);
  document.documentElement.append(host);
  session = s;
  highlight(s);
  input.focus();
}

/**
 * パレットを閉じる。開いていなければ何もしない。
 */
export function closePalette(): void {
  session?.close();
  session = null;
}

/**
 * 開いているか。
 *
 * @returns 開いていれば `true`
 */
export function isPaletteOpen(): boolean {
  return session !== null;
}

/**
 * 欄のそばに置く。下に収まらなければ上、右にはみ出せば左に寄せる。
 *
 * @param panel パレットの箱
 * @param anchor そばに出す欄
 */
function place(panel: HTMLElement, anchor: Element): void {
  const r = anchor.getBoundingClientRect();
  const w = window.innerWidth || PANEL_WIDTH;
  const h = window.innerHeight || PANEL_HEIGHT;
  let top = r.bottom + 4;
  if (top + PANEL_HEIGHT > h && r.top - 4 - PANEL_HEIGHT >= 0) {
    top = r.top - 4 - PANEL_HEIGHT;
  }
  const left = Math.max(4, Math.min(r.left, w - PANEL_WIDTH - 4));
  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(Math.max(4, top))}px`;
}

/**
 * 照合用に整える。ひらがなはカタカナに、全角英数字は半角に、大文字は小文字に。
 * 「せい」と打っても「フリガナ（セイ）」に当たる。
 *
 * @param s 文字列
 * @returns 整えた文字列
 */
function normalize(s: string): string {
  return hiraToKata(s.normalize("NFKC").toLowerCase().replace(/\s+/g, ""));
}

/**
 * 入力で絞り込む。表示名か読みか見出しか id に含まれていれば残す。
 *
 * 「番号で呼び出す」の行があるパレットで数字だけを打ったときは、その行だけを残す。
 * 番号を打っているのに `postal_1` が当たって Enter で郵便番号が入っては困る。
 *
 * @param s セッション
 * @param query 入力された文字列
 */
function filter(s: Session, query: string): void {
  const q = normalize(query);
  const digits = /^\d+$/.test(q);
  s.visible = s.rows.filter((r) => {
    if (digits && s.recall) {
      return r.action.type === "recall";
    }
    if (q === "" || r.text.includes(q) || r.group.includes(q)) {
      return true;
    }
    return r.action.type === "item" && r.action.id.includes(q);
  });
  const shown = new Set(s.visible);
  for (const r of s.rows) {
    r.el.hidden = !shown.has(r);
  }
  // 見出しは、その下に見えている行が 1 つも無ければ隠す。
  for (const h of s.headings) {
    let sib = h.nextElementSibling;
    let any = false;
    while (sib instanceof HTMLLIElement && sib.classList.contains("item")) {
      if (!sib.hidden && !sib.classList.contains("recall")) {
        any = true;
        break;
      }
      sib = sib.nextElementSibling;
    }
    h.hidden = !any;
  }
  s.none.hidden = s.visible.length > 0;
  s.selected = 0;
  highlight(s);
}

/**
 * 選択中の行に印を付け、見える位置まで送る。
 *
 * @param s セッション
 */
function highlight(s: Session): void {
  for (const r of s.rows) {
    r.el.classList.remove("on");
  }
  const cur = s.visible[s.selected];
  if (cur) {
    cur.el.classList.add("on");
    cur.el.scrollIntoView?.({ block: "nearest" });
  }
}

/**
 * キー操作。上下で移動、Enter で決定、Esc で閉じる。
 *
 * ページにキーを渡さない。Enter がフォームの送信になっては困る。
 *
 * @param s セッション
 * @param e キーイベント
 */
function key(s: Session, e: KeyboardEvent): void {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    closePalette();
    return;
  }
  if (s.mode === "recall") {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      recallNow(s, s.input.value);
    }
    return;
  }
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    e.stopPropagation();
    const n = s.visible.length;
    if (n > 0) {
      s.selected = (s.selected + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
      highlight(s);
    }
    return;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();
    const cur = s.visible[s.selected];
    if (cur) {
      pick(s, cur);
    }
  }
}

/**
 * 行を決定する。
 *
 * 行の id を、閉じてから呼び出し側に渡す。呼び出し側が欄に書くとき、パレットは既に無い。
 * 「番号で呼び出す」なら、既に数字が打たれていればそのまま確定、そうでなければ番号待ちに入る。
 *
 * @param s セッション
 * @param row 選ばれた行
 */
function pick(s: Session, row: Row): void {
  if (row.action.type === "recall") {
    const typed = normalize(s.input.value);
    if (/^\d+$/.test(typed)) {
      recallNow(s, typed);
      return;
    }
    enterRecall(s);
    return;
  }
  const onPick = s.onPick;
  const id = row.action.id;
  closePalette();
  onPick(id);
}

/**
 * 番号待ちに入る。一覧と判定を隠し、入力欄を番号用にする。
 *
 * @param s セッション
 */
function enterRecall(s: Session): void {
  if (!s.recall) {
    return;
  }
  s.mode = "recall";
  s.input.value = "";
  s.input.placeholder = s.recall.placeholder;
  s.input.setAttribute("inputmode", "numeric");
  s.list.hidden = true;
  if (s.guess) {
    s.guess.hidden = true;
  }
  s.input.focus();
}

/**
 * 番号を確定して呼び出す。数字でなければ何もしない（打ち直せる）。
 *
 * @param s セッション
 * @param text 打たれた文字列
 */
function recallNow(s: Session, text: string): void {
  const n = Number.parseInt(normalize(text), 10);
  if (!s.recall || !Number.isInteger(n) || n < 0) {
    return;
  }
  const onRecall = s.recall.onRecall;
  closePalette();
  onRecall(n);
}
