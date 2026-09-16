import type { FieldInfo, FieldKind } from "./field";

/**
 * 分割欄のグルーピング。`docs/field-rules.md` §3 の実装。
 *
 * `zip1` `zip2` のように番号が付いていれば classify の段階で決まっている。
 * ここで扱うのは番号の無い分割で、手掛かりは「同じ欄種が DOM 順で並んでいる」こと。
 * `zip` `zip` と 2 つ並べば前 3 桁と後 4 桁、`tel` が 3 つ並べば 3 分割。
 *
 * 触らない欄（`skip`）は並びを切らない。分割欄の間に hidden が挟まっていることは
 * よくあり、それで別々の欄に見えてしまうと 3 つの欄に同じ番号を入れることになる。
 */

/** 隣り合ったときに束ねる欄種と、束ねたあとの欄種。 */
const SPLITS: Partial<Record<FieldKind, Partial<Record<number, FieldKind[]>>>> = {
  postal: { 2: ["postal_1", "postal_2"] },
  tel: { 3: ["tel_1", "tel_2", "tel_3"] },
  birth: { 3: ["birth_y", "birth_m", "birth_d"] },
  name_full: { 2: ["name_family", "name_given"] },
  kana_full: { 2: ["kana_family", "kana_given"] },
  address_full: { 2: ["town", "building"], 3: ["city", "town", "building"] },
  card_number: { 4: ["card_1", "card_2", "card_3", "card_4"] },
  card_expiry: { 2: ["card_expiry_month", "card_expiry_year"] },
};

/** 電話の部分名。番号付きと番号無しが混ざった並びを埋めるのに使う。 */
const TEL_PARTS: FieldKind[] = ["tel_1", "tel_2", "tel_3"];
const POSTAL_PARTS: FieldKind[] = ["postal_1", "postal_2"];

/**
 * 分割欄を束ね直す。
 *
 * 見るのは並びだけで、値は決めない。何番目にどの値が入るかは render の仕事。
 *
 * @param fields form の欄。DOM 順
 * @param kinds classify が決めた欄種。`fields` と同じ並び
 * @returns 束ね直したあとの欄種。`fields` と同じ並び
 */
export function group(fields: readonly FieldInfo[], kinds: readonly FieldKind[]): FieldKind[] {
  const out = [...kinds];
  const live = out.map((k, i) => (k === "skip" ? -1 : i)).filter((i) => i >= 0);

  absorbByLength(fields, out, live);
  splitRuns(fields, out, live);
  fillParts(out, live, "tel", TEL_PARTS);
  fillParts(out, live, "postal", POSTAL_PARTS);
  pairNames(out, live, "name_full", "name_family", "name_given");
  pairNames(out, live, "kana_full", "kana_family", "kana_given");
  return out;
}

/**
 * 姓か名のどちらか片方しか決まっていない並びを埋める。
 *
 * Contact Form 7 の `your-name` と `your-name2` は、2 つ目にだけ番号が付く。
 * 1 つ目は氏名全体に見えるが、隣が「名」なら、こちらは「姓」。
 *
 * @param out 欄種。書き換える
 * @param live 触る欄の位置。DOM 順
 * @param whole 全体の欄種
 * @param family 姓の欄種
 * @param given 名の欄種
 */
function pairNames(
  out: FieldKind[],
  live: number[],
  whole: FieldKind,
  family: FieldKind,
  given: FieldKind,
): void {
  for (let n = 0; n + 1 < live.length; n++) {
    const a = live[n];
    const b = live[n + 1];
    if (out[a] === whole && out[b] === given) {
      out[a] = family;
    } else if (out[a] === family && out[b] === whole) {
      out[b] = given;
    }
  }
}

/**
 * label が付いていない後続の欄を、maxlength で分割の続きとみなす。
 *
 * 「郵便番号」の label は 1 つ目にしか付かず、2 つ目はハイフンの後ろに裸で置かれる
 * ことが多い。1 つ目が 3 桁で 2 つ目が 4 桁なら、後ろも郵便番号。電話も同じで、
 * 4 桁以下の text が 2 つ続けば 3 分割の残り。
 *
 * @param fields form の欄
 * @param out 欄種。書き換える
 * @param live 触る欄の位置。DOM 順
 */
function absorbByLength(fields: readonly FieldInfo[], out: FieldKind[], live: number[]): void {
  for (let n = 0; n < live.length; n++) {
    const i = live[n];
    const next = live[n + 1];
    if (next === undefined) {
      continue;
    }
    if (
      out[i] === "postal" &&
      out[next] === "text" &&
      fields[i].maxlength === 3 &&
      fields[next].maxlength === 4
    ) {
      out[i] = "postal_1";
      out[next] = "postal_2";
      continue;
    }
    const third = live[n + 2];
    if (
      out[i] === "tel" &&
      third !== undefined &&
      isShortText(fields[next], out[next]) &&
      isShortText(fields[third], out[third])
    ) {
      out[i] = "tel_1";
      out[next] = "tel_2";
      out[third] = "tel_3";
      continue;
    }
    // カード番号も同じ。label は 1 つ目にしか付かず、4 桁の箱が 3 つ続く。
    const fourth = live[n + 3];
    if (
      out[i] === "card_number" &&
      fourth !== undefined &&
      [next, third, fourth].every((p) => isShortText(fields[p], out[p]))
    ) {
      out[i] = "card_1";
      out[next] = "card_2";
      out[third] = "card_3";
      out[fourth] = "card_4";
    }
  }
}

/**
 * 何にも当たらなかった、4 桁以下の text か。
 *
 * @param field 欄
 * @param kind その欄種
 * @returns 電話の続きとして吸えるなら `true`
 */
function isShortText(field: FieldInfo, kind: FieldKind): boolean {
  return kind === "text" && field.maxlength !== null && field.maxlength <= 4;
}

/**
 * 同じ欄種の並びを分割に置き換える。
 *
 * 個数が表に無ければ触らない。`tel` が 2 つだけの並びは {@link splitTelPair} で
 * maxlength を見て決める。
 *
 * @param fields form の欄
 * @param out 欄種。書き換える
 * @param live 触る欄の位置。DOM 順
 */
function splitRuns(fields: readonly FieldInfo[], out: FieldKind[], live: number[]): void {
  let n = 0;
  while (n < live.length) {
    const kind = out[live[n]];
    let end = n + 1;
    while (end < live.length && out[live[end]] === kind) {
      end++;
    }
    const count = end - n;
    const positions = live.slice(n, end);

    const table = SPLITS[kind];
    const replacement = table?.[count];
    if (
      replacement &&
      !tooLongToSplit(
        kind,
        positions.map((p) => fields[p]),
      )
    ) {
      positions.forEach((p, k) => {
        out[p] = replacement[k];
      });
    } else if (kind === "tel" && count === 2) {
      const [a, b] = splitTelPair(fields[positions[0]], fields[positions[1]]);
      out[positions[0]] = a;
      out[positions[1]] = b;
    }
    n = end;
  }
}

/**
 * 並んではいるが、桁数からして分割ではないもの。
 *
 * 郵便番号の欄が 2 つ並んでいても、片方に maxlength=7 があるなら、それは全体を
 * 入れる欄。前 3 桁の欄に 7 桁は許さない。カード番号の 4 分割も 4 桁の箱に限る。電話も同じで、3 つ並んだ欄のどれかが
 * 6 桁以上を許すなら、3 分割ではなく別々の電話番号。
 *
 * @param kind 並んでいる欄種
 * @param fields 並んでいる欄
 * @returns 分割として扱わないなら `true`
 */
function tooLongToSplit(kind: FieldKind, fields: readonly FieldInfo[]): boolean {
  // 有効期限が 2 つ並んでも、片方が MM/YY を丸ごと受ける欄（maxlength 5 以上、type=month）なら
  // 月・年の分割ではない。
  if (kind === "card_expiry") {
    return fields.some((f) => f.type === "month" || (f.maxlength !== null && f.maxlength >= 5));
  }
  const limit = kind === "postal" || kind === "card_number" ? 5 : kind === "tel" ? 6 : null;
  if (limit === null) {
    return false;
  }
  return fields.some((f) => f.maxlength !== null && f.maxlength >= limit);
}

/**
 * 電話が 2 つ並んだときの割り当て。
 *
 * 「090-1234 / 5678」か「090 / 1234-5678」かは maxlength でしか分からない。
 * 1 つ目が 6〜8 桁なら前者、1 つ目が 3 桁か 2 つ目が 8 桁以上なら後者。
 * どちらとも言えなければ全体を 1 つ目に入れ、2 つ目は空けておく。
 * 半端に分けると、どちらの解釈でも通らない値になる。
 *
 * @param first 1 つ目の欄
 * @param second 2 つ目の欄
 * @returns 2 つの欄種
 */
function splitTelPair(first: FieldInfo, second: FieldInfo): [FieldKind, FieldKind] {
  const a = first.maxlength;
  const b = second.maxlength;
  if (a !== null && a >= 6 && a <= 8) {
    return ["tel_12", "tel_3"];
  }
  if (a === 3 || (b !== null && b >= 8)) {
    return ["tel_1", "tel_23"];
  }
  return ["tel", "skip"];
}

/**
 * 番号付きと番号無しが混ざった並びを埋める。
 *
 * `tel_area` `tel_local` `tel_number` のように、3 つ目だけ語が無くて `tel` に
 * 落ちることがある。並びの中で空いている番号を、番号の無い欄に順に振る。
 * 2 つだけの並びで 1 つが `tel_1` なら、残りは後ろ 2 つ分（`tel_23`）。
 *
 * @param out 欄種。書き換える
 * @param live 触る欄の位置。DOM 順
 * @param plain 番号の無い欄種
 * @param parts 番号付きの欄種。1 番目から順
 */
function fillParts(out: FieldKind[], live: number[], plain: FieldKind, parts: FieldKind[]): void {
  const family = new Set<FieldKind>([plain, ...parts]);
  let n = 0;
  while (n < live.length) {
    if (!family.has(out[live[n]])) {
      n++;
      continue;
    }
    let end = n + 1;
    while (end < live.length && family.has(out[live[end]])) {
      end++;
    }
    const positions = live.slice(n, end);
    n = end;

    const kinds = positions.map((p) => out[p]);
    const blanks = positions.filter((p) => out[p] === plain);
    if (blanks.length === 0 || blanks.length === positions.length) {
      continue;
    }
    if (positions.length === parts.length) {
      const missing = parts.filter((k) => !kinds.includes(k));
      blanks.forEach((p, k) => {
        if (missing[k] !== undefined) {
          out[p] = missing[k];
        }
      });
    } else if (positions.length === 2 && plain === "tel" && blanks.length === 1) {
      const other = kinds.find((k) => k !== plain);
      if (other === "tel_1") {
        out[blanks[0]] = "tel_23";
      } else if (other === "tel_3") {
        out[blanks[0]] = "tel_12";
      } else if (other === "tel_2") {
        out[blanks[0]] = positions[0] === blanks[0] ? "tel_1" : "tel_3";
      }
    }
  }
}
