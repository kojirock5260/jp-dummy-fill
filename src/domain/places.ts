import { type Address, CENTERS, ISLANDS } from "./data/addresses";

/**
 * 「住所を遠隔地・離島に替える…」のパレットに並べる場所。
 *
 * 区分は配送業者に合わせた（2026-09-06 調査）。
 *
 * - ヤマト運輸 … 離島の追加料金は無い。料金は発地と着地の都道府県（地帯）で決まり、
 *   北海道と沖縄は別の地帯。離島はお届け日数が延び、クール宅急便が使えない島がある
 * - 佐川急便 … 沖縄全域と、一覧にある島に「離島中継料」が掛かる。この一覧を EC サイトの
 *   多くがそのまま「離島」の定義に使っている
 * - Amazon.co.jp … 配送料は「本州・四国」と「北海道・九州・沖縄・離島」の 2 区分
 *
 * 3 社が揃って分けているのは 北海道・沖縄・離島。Amazon は九州も分ける。だから並べるのは
 * その 4 つの代表地と、佐川の一覧から名の知れた島。「同じ県の遠隔地」はどの業者にも
 * 区分が無いので置かない。
 *
 * 表示名は日本語のまま。入る値が日本語なので、UI が英語でも訳さない。
 */

export type PlaceItem = {
  /** 住所データの 1 件を指す。`Place` の `at` に渡す */
  zip: string;
  /** 「佐渡島（新潟県佐渡市）」 */
  label: string;
  /** 絞り込みに使う読み。「さど」で佐渡島が残る */
  aliases: readonly string[];
};

export type PlaceGroup = {
  id: "region" | "island";
  items: readonly PlaceItem[];
};

/** 配送料の区分が別の地域と、その代表にする中心地。 */
const REGIONS: readonly { pref: string; name: string; kana: string }[] = [
  { pref: "北海道", name: "北海道", kana: "ホッカイドウ" },
  { pref: "福岡県", name: "九州", kana: "キュウシュウ" },
  { pref: "沖縄県", name: "沖縄本島", kana: "オキナワホントウ" },
];

/**
 * パレットの 1 行にする。
 *
 * @param a 住所
 * @param name 通称（「佐渡島」「九州」）
 * @param kana 通称の読み
 * @returns 表示名と読み
 */
function itemOf(a: Address, name: string, kana: string): PlaceItem {
  // 「北海道（北海道札幌市中央区）」と重ねない。
  const label = name === a.pref ? `${a.pref}（${a.city}）` : `${name}（${a.pref}${a.city}）`;
  return { zip: a.zip, label, aliases: [kana, a.prefKana, a.cityKana, a.townKana] };
}

export const PLACE_GROUPS: readonly PlaceGroup[] = [
  {
    id: "region",
    items: REGIONS.flatMap((r) => {
      const a = CENTERS.find((c) => c.pref === r.pref);
      return a ? [itemOf(a, r.name, r.kana)] : [];
    }),
  },
  {
    id: "island",
    items: ISLANDS.map((a) => itemOf(a, a.name ?? a.city, a.nameKana ?? a.cityKana)),
  },
];
