/**
 * seed 付きの乱数。
 *
 * `Math.random` を使わないのは、同じ seed から必ず同じ人物を作るため。
 * seed 0 に戻せば最初の人物（阿部 翔）に戻る。
 * テストは `generate(0)` の出力をスナップショットで固定している。
 *
 * mulberry32。暗号用ではないが、ここに要るのは再現性だけ。
 */

export type Random = {
  /** 0 以上 1 未満。 */
  next(): number;
  /** `min` 以上 `max` 以下の整数。 */
  int(min: number, max: number): number;
  /** 配列から 1 つ。 */
  pick<T>(items: readonly T[]): T;
};

/**
 * 乱数列を作る。
 *
 * @param seed 種。整数でなくてもよいが、同じ値からは同じ列が出る
 * @returns 乱数列
 */
export function createRandom(seed: number): Random {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // 最初の 1 つは捨てる。隣り合う小さな seed の初回出力は近い値になり、seed 0 と 1 で
  // 同じ姓を引く。続きの番号で苗字が変わらないのは、壊れているように見える。
  next();
  return {
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
  };
}
