import { classify } from "./classify";
import { parsePrefecture } from "./data/addresses";
import type { FieldInfo, FieldKind } from "./field";
import { group } from "./group";
import { generate, type Person, type Place, pickAddress } from "./person";
import { appendix, render } from "./render";

/**
 * 集めた欄から、どこに何を書くかを決める。spec §3 の 2〜6（classify → group →
 * constrain → generate → render）を 1 つに繋いだもの。
 *
 * DOM を触らないので、content.ts は collect の結果をここに渡し、返ってきた計画を
 * write に渡すだけになる。計画の中身は全部ここでテストできる。
 */

/** どの人物を、どの住所で。content.ts がページ内に持つ状態から作る。 */
export type Variant = {
  seed: number;
  place: Place;
  /** 住所の都道府県。あればページで選ばれている都道府県より優先。住所の巡りの起点に戻るときに使う */
  pref?: string;
};

/** 1 欄ぶんの計画。`value` が `null` なら触らない。 */
export type Entry = {
  index: number;
  kind: FieldKind;
  value: string | null;
};

export type Plan = {
  person: Person;
  entries: Entry[];
  /** 郵便番号から補完された住所欄に足す番地（spec §3 の 7b）。 */
  appendix: { endsWith: string; add: string };
};

/**
 * 計画を立てる。
 *
 * 都道府県が既に選ばれていれば、その県の人物にする（spec §2）。select だけ先に
 * 手で選んでおけば狙った県になる、という使い方のため。
 *
 * @param fields collect が集めた欄。DOM 順
 * @param variant 人物と住所の選び方
 * @param today 年齢の基準日。省略時は現在
 * @returns 欄ごとの値と、使った人物
 */
export function makePlan(
  fields: readonly FieldInfo[],
  variant: Variant,
  today: Date = new Date(),
): Plan {
  const kinds = group(fields, classify(fields));
  const set = new Set(kinds);
  const pref = variant.pref ?? selectedPrefecture(fields, kinds);
  const person = generate(variant.seed, { pref, place: variant.place }, today);
  const ctx = { today, kinds: set };

  const entries = fields.map((field, i) => ({
    index: field.index,
    kind: kinds[i],
    value: render(kinds[i], person, field, ctx),
  }));
  return { person, entries, appendix: appendix(person, set) };
}

/**
 * 自動の判定なら、その欄を何と見るか。パレットに「自動の判定」として出す。
 *
 * @param fields collect が集めた欄。DOM 順
 * @param index 見る欄の位置
 * @returns 欄種
 */
export function guess(fields: readonly FieldInfo[], index: number): FieldKind {
  return kindsOf(fields)[index];
}

/**
 * 全欄の自動の判定。分割欄の並びまで解いたもの。
 *
 * @param fields collect が集めた欄。DOM 順
 * @returns 欄ごとの欄種
 */
export function kindsOf(fields: readonly FieldInfo[]): FieldKind[] {
  return group(fields, classify(fields));
}

/**
 * 1 つの欄に、人が選んだ欄種の値を作る。右クリックの「この欄にデータを埋める」。
 *
 * 他の欄の判定は自動のときと同じに行い、選んだ欄だけ欄種を差し替える。周りの欄種が
 * 要るのは、都道府県や建物の欄があるかで住所の中身が変わるため。人物も自動のときと
 * 同じ seed から作るので、手で入れた欄だけ別人にはならない。
 *
 * @param fields collect が集めた欄。DOM 順
 * @param index 入れる欄の位置
 * @param kind 人が選んだ欄種
 * @param variant 人物と住所の選び方
 * @param today 年齢の基準日。省略時は現在
 * @returns 入れる値と、使った人物、自動の判定なら何だったか
 */
export function planOne(
  fields: readonly FieldInfo[],
  index: number,
  kind: FieldKind,
  variant: Variant,
  today: Date = new Date(),
): { value: string | null; person: Person; guessed: FieldKind } {
  const kinds = group(fields, classify(fields));
  const guessed = kinds[index];
  kinds[index] = kind;
  const pref = variant.pref ?? selectedPrefecture(fields, kinds);
  const person = generate(variant.seed, { pref, place: variant.place }, today);
  const value = render(kind, person, fields[index], { today, kinds: new Set(kinds) });
  return { value, person, guessed };
}

/**
 * 今の選び方で人物が住む都道府県。「住所を遠隔地・離島に替える」の巡りの起点を控える。
 *
 * 離島は都道府県の select を離島の県に書き換える。そのあと「元」に戻るとき select を
 * 読むと離島の県の中心になってしまうので、巡りに入る前にここで起点を取っておく。
 *
 * @param fields collect が集めた欄。DOM 順
 * @param variant 人物と住所の選び方
 * @returns 都道府県名
 */
export function homePrefecture(fields: readonly FieldInfo[], variant: Variant): string {
  const kinds = group(fields, classify(fields));
  const pref = variant.pref ?? selectedPrefecture(fields, kinds);
  return pickAddress(variant.seed, { pref, place: variant.place }).pref;
}

/**
 * フォームで既に選ばれている都道府県。
 *
 * select の value が「13」でも表示テキストが「東京都」なら分かる。どちらでも
 * 読めなければ選ばれていないものとして扱う。
 *
 * @param fields 欄
 * @param kinds 欄種
 * @returns 都道府県名。選ばれていなければ `undefined`
 */
function selectedPrefecture(
  fields: readonly FieldInfo[],
  kinds: readonly FieldKind[],
): string | undefined {
  for (let i = 0; i < fields.length; i++) {
    if (kinds[i] !== "prefecture" || !fields[i].hasValue) {
      continue;
    }
    const field = fields[i];
    const option = field.options.find((o) => o.value === field.value);
    const hit = parsePrefecture(field.value) ?? (option ? parsePrefecture(option.text) : null);
    if (hit) {
      return hit.name;
    }
  }
  return undefined;
}
