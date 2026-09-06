import { ADDRESS_KINDS, type FieldKind } from "../domain/field";
import type { Plan } from "../domain/plan";
import { type Collected, type FormElement, hasValue } from "./collect";

/**
 * 値の書き込みとイベント発火。spec §3 の 7・7b。
 *
 * 書く順序に意味がある。郵便番号を先に書いて少し待ち、その時点で空の欄だけ書く。
 * ページ側に郵便番号→住所の補完（yubinbango, ajaxzip3）があれば、その間に住所を
 * 埋めてくれる。補完が入れた値と自前の値は同じ実在の組なので、どちらが勝っても
 * 同じ住所になる。
 */

/** 郵便番号を書いてから、補完が住所を埋めるのを待つ時間（ミリ秒）。 */
export const AUTOFILL_WAIT_MS = 300;

/** 郵便番号の欄種。先に書くもの。 */
const POSTAL: ReadonlySet<FieldKind> = new Set(["postal", "postal_1", "postal_2"]);

/** 補完が町域までしか入れなかったとき、番地を足す欄種。 */
const APPENDABLE: ReadonlySet<FieldKind> = new Set(["town", "address_full", "city"]);

/**
 * 指定した時間だけ待つ。
 *
 * @param ms 待つ時間（ミリ秒）
 * @returns 時間が経つと解決する Promise
 */
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * 計画どおりに書く。
 *
 * 「値がある欄は飛ばす」の判定は、計画を立てたときではなく書く直前に行う。
 * 郵便番号を書いたあとの待ち時間に補完が埋めた欄を、二重に書かないため。
 *
 * @param collected collect が集めた欄
 * @param plan makePlan が立てた計画
 * @param wait 待ち方の差し替え。テストからは即座に解決するものを渡す
 * @returns 値を書いた欄の数。番地を足した欄も数える
 */
export async function writePlan(
  collected: readonly Collected[],
  plan: Plan,
  wait: (ms: number) => Promise<void> = sleep,
): Promise<number> {
  let count = 0;
  const pending = plan.entries.filter((e) => e.value !== null);

  const postal = pending.filter((e) => POSTAL.has(e.kind));
  for (const e of postal) {
    if (write(collected[e.index], e.value ?? "")) {
      count += 1;
    }
  }
  if (postal.length > 0) {
    await wait(AUTOFILL_WAIT_MS);
  }

  for (const e of pending) {
    if (POSTAL.has(e.kind)) {
      continue;
    }
    if (write(collected[e.index], e.value ?? "")) {
      count += 1;
    }
  }

  for (const e of plan.entries) {
    if (APPENDABLE.has(e.kind) && appendBlock(collected[e.index], plan.appendix)) {
      count += 1;
    }
  }
  return count;
}

/**
 * 人が選んだ欄種の値を、1 つの欄に上書きで入れる。右クリックの「この欄にデータを埋める」。
 *
 * 「値がある欄は飛ばす」の例外。自動の判定が外して変な値が入った欄を直すのが
 * この操作の目的なので、上書きしないと用を成さない。人が欄を名指しで選んでいる
 * ので、消してよい値かどうかの判断も人がしている。
 *
 * @param c 書く欄
 * @param value 書く値
 * @returns 書いたら `true`。radio に合う選択肢が無ければ `false`
 */
export function writeOne(c: Collected, value: string): boolean {
  return write(c, value, true);
}

/**
 * 住所の欄だけを上書きする。「住所を遠隔地・離島に替える」。
 *
 * 埋まったページで押されるのが普通なので、「値がある欄は飛ばす」では何も起きない。
 * 住所に属する欄種（{@link ADDRESS_KINDS}）だけを、今の人物の新しい住所で書き直す。
 * 郵便番号を先に書くのは自動入力と同じ理由だが、ここでは待たない。補完が何を書いても、
 * そのあとで同じ実在の組を上書きする。
 *
 * @param collected collect が集めた欄
 * @param plan 新しい住所で立てた計画
 * @returns 書き直した欄の数
 */
export function writeAddress(collected: readonly Collected[], plan: Plan): number {
  const entries = plan.entries.filter((e) => ADDRESS_KINDS.has(e.kind) && e.value !== null);
  const ordered = [
    ...entries.filter((e) => POSTAL.has(e.kind)),
    ...entries.filter((e) => !POSTAL.has(e.kind)),
  ];
  let count = 0;
  for (const e of ordered) {
    if (writeOne(collected[e.index], e.value ?? "")) {
      count += 1;
    }
  }
  return count;
}

/**
 * 1 欄に書く。既に値があれば書かない（`overwrite` で上書き）。
 *
 * @param c 書く欄
 * @param value 書く値
 * @param overwrite 既にある値の上に書くか
 * @returns 書いたら `true`
 */
function write(c: Collected, value: string, overwrite = false): boolean {
  if (c.radios) {
    if (!overwrite && c.radios.some((r) => r.checked)) {
      return false;
    }
    const hit = c.radios.find((r) => r.value === value);
    if (!hit) {
      return false;
    }
    check(hit);
    return true;
  }
  if (!overwrite && hasValue(c.el)) {
    return false;
  }
  const el = c.el;
  if (el instanceof HTMLSelectElement) {
    return selectOption(el, value);
  }
  if (el instanceof HTMLInputElement && el.type === "checkbox") {
    check(el);
    return true;
  }
  setValue(el, value);
  return true;
}

/**
 * 補完が町域までしか入れなかった住所欄に、番地を足す（spec §3 の 7b）。
 *
 * 「値がある欄は飛ばす」の唯一の例外。値が Person の町域で終わっていて、数字を
 * 含まないときだけ末尾に足す。町域で終わっていなければ人が書いたものとみなして触らない。
 *
 * @param c 対象の欄
 * @param appendix 町域と、足す文字列
 * @returns 足したら `true`
 */
function appendBlock(c: Collected, appendix: Plan["appendix"]): boolean {
  const el = c.el;
  if (el instanceof HTMLSelectElement || c.radios) {
    return false;
  }
  const current = el.value;
  if (current === "" || !current.endsWith(appendix.endsWith) || /\d/.test(current)) {
    return false;
  }
  setValue(el, `${current}${appendix.add}`);
  return true;
}

// ---------- 書き込みの原子操作 ----------

/**
 * 値を入れて、入力があったことをページに知らせる。
 *
 * `el.value = x` ではなく、プロトタイプの native setter を呼ぶ。React は要素の
 * `value` に自前の setter を被せて「最後に自分が入れた値」を覚えており、同じ値の
 * `input` イベントを無視する。プロトタイプ側の setter を直接呼べば React の記録は
 * 古いままなので、次の `input` イベントで変化として拾ってくれる。
 *
 * 発火するのは `input` `change` `blur`。`keydown` `keyup` は投げない。autokana の
 * ようなふりがな自動入力はキー入力を拾って隣の欄を書くので、投げると誤作動する。
 *
 * @param el 書く欄
 * @param value 書く値
 */
export function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = Object.getPrototypeOf(el) as object;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }
  fire(el);
}

/**
 * select の選択肢を選ぶ。value の一致 → 表示テキストの一致 → 部分一致の順。
 *
 * 計画の値は選択肢の value から作ってあるので、普段は最初の一致で決まる。
 * 残りは、計画と DOM の間で選択肢が動的に変わったときの保険。
 *
 * @param el select
 * @param value 選びたい value（または表示テキスト）
 * @returns 選べたら `true`
 */
export function selectOption(el: HTMLSelectElement, value: string): boolean {
  const options = [...el.options];
  const hit =
    options.find((o) => o.value === value) ??
    options.find((o) => (o.textContent ?? "").trim() === value) ??
    options.find((o) => (o.textContent ?? "").includes(value));
  if (!hit) {
    return false;
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  if (setter) {
    setter.call(el, hit.value);
  } else {
    el.value = hit.value;
  }
  fire(el);
  return true;
}

/**
 * checkbox / radio を ON にする。
 *
 * `click()` ではなく `checked = true` にする。click はページの click ハンドラまで
 * 動かしてしまい、規約のリンクを開くような副作用が起きる。
 *
 * @param el checkbox か radio
 */
export function check(el: HTMLInputElement): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")?.set;
  if (setter) {
    setter.call(el, true);
  } else {
    el.checked = true;
  }
  fire(el);
}

/**
 * 入力があったことを知らせるイベントを投げる。
 *
 * @param el 書いた欄
 */
function fire(el: FormElement): void {
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new FocusEvent("blur"));
}
