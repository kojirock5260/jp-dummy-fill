import raw from "../../../data/addresses.json";

/**
 * 住所データ。`data/addresses.json` を型付きで読む。
 *
 * 65 件（中心 47・離島 18）。郵便番号・都道府県・市区町村・町域と読みは日本郵便の郵便番号データで
 * 実在を確かめたもので、`scripts/build-addresses.ts` が `addresses.src.json` から
 * 作り直す。番地と建物はここには無く、Person を作るときに架空の値を足す。
 *
 * バンドルに同梱される。実行時にどこかへ取りに行くことはない。
 */

/**
 * 配送区分。北海道・沖縄・離島は配送料や配達日数の区分が別になる。
 *
 * 石垣は `okinawa` と `island` の両方なので配列になっている。
 */
export type Zone = "main" | "hokkaido" | "okinawa" | "island";

/**
 * リストの中での役割。
 *
 * - `center` … 各都道府県 1 件。県庁所在地の官庁街。seed 0 は東京都千代田区霞が関
 * - `island` … 18 件。佐川急便の離島中継料の対象一覧から、名の知れた島を選んだ
 */
export type AddressKind = "center" | "island";

export type Address = {
  /** `100-0013` の形。 */
  zip: string;
  /** JIS X 0401 の都道府県コード。北海道 = 1 … 沖縄県 = 47。select の value に使われる。 */
  prefCode: number;
  pref: string;
  /** 全角カタカナ。 */
  prefKana: string;
  city: string;
  cityKana: string;
  town: string;
  /** 全角カタカナ。数字は半角（「キタ3ジョウニシ」）。 */
  townKana: string;
  kind: AddressKind;
  zone: Zone[];
  /** 市外局番。先頭の 0 を含む（「03」「045」「0776」）。 */
  areaCode: string;
  note: string;
  /** 島の通称（「佐渡島」「伊豆大島」）。離島だけ。パレットの表示名になる */
  name?: string;
  /** 通称の読み。全角カタカナ。パレットの絞り込みに使う */
  nameKana?: string;
};

export const ADDRESSES: readonly Address[] = raw as Address[];

/** 中心 47 件。都道府県コード順。 */
export const CENTERS: readonly Address[] = ADDRESSES.filter((a) => a.kind === "center").sort(
  (a, b) => a.prefCode - b.prefCode,
);

/** 離島 18 件。都道府県コード順。 */
export const ISLANDS: readonly Address[] = ADDRESSES.filter((a) => a.kind === "island");

/**
 * 郵便番号で 1 件を引く。「住所を遠隔地・離島に替える」で人が選んだ場所を指すのに使う。
 *
 * @param zip `100-0013` の形
 * @returns その住所。無ければ `undefined`
 */
export function findAddress(zip: string): Address | undefined {
  return ADDRESSES.find((a) => a.zip === zip);
}

/** 都道府県の一覧。名前・読み・コード。select の選択肢を当てるのに使う。 */
export const PREFECTURES: readonly { code: number; name: string; kana: string }[] = CENTERS.map(
  (a) => ({ code: a.prefCode, name: a.pref, kana: a.prefKana }),
);

/**
 * 都道府県名の末尾（都・道・府・県）を落とす。「東京都」→「東京」。
 *
 * 「北海道」だけは落とさない。「北海」では通じない。
 *
 * @param name 都道府県名
 * @returns 末尾を落とした名前
 */
export function shortPref(name: string): string {
  return name === "北海道" ? name : name.replace(/[都府県]$/, "");
}

/**
 * 都道府県を表す文字列を解釈する。「東京都」「東京」「13」「トウキョウト」のどれでも。
 *
 * @param text select の value や表示テキスト
 * @returns 一致した都道府県。無ければ `null`
 */
export function parsePrefecture(text: string): (typeof PREFECTURES)[number] | null {
  const t = text.trim().normalize("NFKC");
  if (t === "") {
    return null;
  }
  const n = Number(t);
  for (const p of PREFECTURES) {
    if (t === p.name || t === shortPref(p.name) || t === p.kana || n === p.code) {
      return p;
    }
  }
  return null;
}
