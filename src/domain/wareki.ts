/**
 * 西暦と和暦の変換。
 *
 * 元号の select があるフォームでは、年の欄に和暦年を入れる（`docs/field-rules.md` §5.3）。
 * 生年月日は 20〜65 歳になる日付なので、実際に出てくるのは昭和と平成と令和だけだが、
 * select の選択肢を当てるのに明治・大正も要る。
 */

export type Era = {
  name: string;
  /** 頭文字。「R6」のような表記や、select の value に使われる。 */
  initial: string;
  /** JIS X 0301 の元号コード。明治 = 1 … 令和 = 5。select の value に使われる。 */
  code: number;
  /** 元年の始まり。 */
  start: { y: number; m: number; d: number };
};

/** 新しいものから順。変換は上から見て、始まりを過ぎていれば決まる。 */
export const ERAS: readonly Era[] = [
  { name: "令和", initial: "R", code: 5, start: { y: 2019, m: 5, d: 1 } },
  { name: "平成", initial: "H", code: 4, start: { y: 1989, m: 1, d: 8 } },
  { name: "昭和", initial: "S", code: 3, start: { y: 1926, m: 12, d: 25 } },
  { name: "大正", initial: "T", code: 2, start: { y: 1912, m: 7, d: 30 } },
  { name: "明治", initial: "M", code: 1, start: { y: 1868, m: 1, d: 25 } },
];

/**
 * 日付の前後を比べる。
 *
 * @returns `a` が `b` 以後なら `true`
 */
function onOrAfter(a: { y: number; m: number; d: number }, b: { y: number; m: number; d: number }) {
  if (a.y !== b.y) {
    return a.y > b.y;
  }
  if (a.m !== b.m) {
    return a.m > b.m;
  }
  return a.d >= b.d;
}

/**
 * 西暦の日付を和暦にする。
 *
 * @param y 西暦年
 * @param m 月（1〜12）
 * @param d 日
 * @returns 元号と和暦年。明治より前なら `null`
 */
export function toWareki(y: number, m: number, d: number): { era: Era; year: number } | null {
  for (const era of ERAS) {
    if (onOrAfter({ y, m, d }, era.start)) {
      return { era, year: y - era.start.y + 1 };
    }
  }
  return null;
}

/**
 * 和暦年を西暦年にする。
 *
 * @param era 元号
 * @param year 和暦年（元年は 1）
 * @returns 西暦年
 */
export function fromWareki(era: Era, year: number): number {
  return era.start.y + year - 1;
}

/**
 * 元号を表す文字列を解釈する。「平成」「H」「h」「4」「平」のどれでも。
 *
 * @param text select の value や表示テキスト
 * @returns 一致した元号。無ければ `null`
 */
export function parseEra(text: string): Era | null {
  const t = text.trim().normalize("NFKC");
  for (const era of ERAS) {
    if (
      t === era.name ||
      t === era.name[0] ||
      t.toUpperCase() === era.initial ||
      t === String(era.code)
    ) {
      return era;
    }
  }
  return null;
}
