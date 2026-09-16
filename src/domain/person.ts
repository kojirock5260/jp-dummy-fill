import { type Address, CENTERS, findAddress } from "./data/addresses";
import { FAMILY, GIVEN_FEMALE, GIVEN_MALE } from "./data/names";
import { toRomaji } from "./kana";
import { createRandom, type Random } from "./random";

/**
 * 一人ぶんのダミーデータ。`docs/field-rules.md` §4。
 *
 * 要点は「先に一人ぶん作ってから配る」こと。欄ごとに独立に乱数を引くと、郵便番号と
 * 都道府県が食い違う。ここで作った 1 人を、render が欄種ごとに切り出す。
 *
 * 同じ seed からは必ず同じ Person が出る。テストがスナップショットで固定している。
 */

export type Sex = "male" | "female";

/**
 * 住所の選び方。
 *
 * - `center` … 中心 47 件から seed で 1 件。seed 0 は東京都千代田区霞が関
 * - `at` … 人が選んだ場所。`zip` で住所データの 1 件を指す（`domain/places.ts` に並ぶもの）
 */
export type Place = { kind: "center" } | { kind: "at"; zip: string };

export type Constraint = {
  /** フォームで既に選ばれている都道府県名（「東京都」）。あればその県の住所にする。 */
  pref?: string;
  /** 住所の選び方。省略時は中心。 */
  place?: Place;
};

export type Person = {
  seed: number;
  sex: Sex;
  /** 漢字。 */
  family: string;
  given: string;
  /** ひらがな。欄の文字種に合わせて render が変換する。 */
  familyKana: string;
  givenKana: string;
  /** ヘボン式ローマ字。小文字（「abe」「shou」）。大文字にするかは render が欄の例を見て決める */
  familyRomaji: string;
  givenRomaji: string;
  /** `data/addresses.json` の 1 件。郵便番号から町域までは実在。 */
  address: Address;
  /** 番地。「1-2-3」。架空 */
  block: string;
  /** 建物。「霞が関ビル 403」。架空。建物名と部屋番号を別の欄に入れるフォームのために分けても持つ */
  building: string;
  /** 「霞が関ビル」 */
  buildingName: string;
  /** 「403」 */
  room: string;
  /** 携帯。「090-0XXX-XXXX」。制度上存在しない帯 */
  mobile: string;
  /** 固定。市外局番 + 1 で始まる市内局番 + 4 桁。市内局番は 0・1 で始まらないので実在しない */
  landline: string;
  /**
   * `{given}.{family}.{seed}@example.jp`。example.jp は JPRS の例示用予約ドメイン。
   *
   * 番号を入れるのは、会員登録で同じメールアドレスが二度目に弾かれるため。同じ姓名の
   * 人が別の seed で出ても衝突しない。
   */
  email: string;
  /** `{family}_{given}_{seed}`。ローマ字。メールと同じ理由で番号が付く */
  username: string;
  /** 固定の 1 本。確認欄と合わせるため、テストで再入力するため */
  password: string;
  birth: { y: number; m: number; d: number };
  /** `birth` と生成時の日付から出した満年齢。20〜65 */
  age: number;
  company: string;
  /** ひらがな。 */
  companyKana: string;
  department: string;
  title: string;
  url: string;
  /**
   * 法人番号。13 桁で、先頭の 1 桁が検査用数字。国税庁の検査式を満たすので、
   * チェックデジットを見るフォームを通る。12 桁は乱数で、特定の法人を指してはいない
   */
  corporateNumber: string;
  /** 適格請求書発行事業者の登録番号。法人は `T` + 法人番号 */
  invoiceNumber: string;
  card: Card;
};

/**
 * クレジットカード。決済代行のテスト用番号で、本番の決済には通らない。
 *
 * 4242 4242 4242 4242 は Stripe の Visa テスト番号で、Luhn を満たす。他の決済代行でも
 * 「Luhn を満たす Visa の番号」としてテスト環境で受け付けられることが多い。
 * 有効期限は基準日から 3 年後の 12 月。期限切れの判定に掛からず、遠すぎて弾かれもしない。
 */
export type Card = {
  /** 16 桁。区切り無し */
  number: string;
  brand: "visa";
  /** 1〜12 */
  expMonth: number;
  /** 西暦 4 桁 */
  expYear: number;
  cvc: string;
};

/** カード番号。Stripe の Visa テスト番号。 */
export const CARD_NUMBER = "4242424242424242";

/**
 * パスワード。大文字・小文字・数字・記号を含む 12 桁。
 *
 * ランダムにしないのは、確認欄と合わせづらい上、テストで再入力できないから。
 * 記号は `!` にしてある。記号を必須にするフォームで、いちばん弾かれにくい。
 */
export const PASSWORD = "Dummy!Pass01";

/** 中心 47 件の中で seed 0 が指す位置。 */
const TOKYO = CENTERS.findIndex((a) => a.pref === "東京都");

/**
 * 負の数でも 0 以上 `n` 未満に収める剰余。
 *
 * @param x 割られる数
 * @param n 割る数。1 以上
 * @returns 0 以上 `n` 未満
 */
const mod = (x: number, n: number): number => ((x % n) + n) % n;

/**
 * seed と制約から住所を選ぶ。
 *
 * 乱数は使わない。seed が 1 進むと中心 47 件を 1 つ進むだけなので、
 * seed が 47 進めば全都道府県を一巡する。
 *
 * @param seed 人物の seed
 * @param constraint 都道府県と選び方
 * @returns 選んだ住所
 */
export function pickAddress(seed: number, constraint: Constraint = {}): Address {
  const place = constraint.place ?? { kind: "center" };
  if (place.kind === "at") {
    // 人が地名を選んでいる。フォームで選ばれている都道府県より、選んだ場所が勝つ。
    const at = findAddress(place.zip);
    if (at) {
      return at;
    }
  }
  const fixed = constraint.pref ? CENTERS.find((a) => a.pref === constraint.pref) : undefined;
  return fixed ?? CENTERS[mod(TOKYO + seed, CENTERS.length)];
}

/**
 * 固定電話番号を作る。
 *
 * 市外局番と市内局番と加入者番号で合わせて 10 桁。市外局番が長いほど市内局番は短い
 * （03-1234-5678 / 045-123-4567 / 0776-12-3456 / 04998-1-2345）。市内局番の先頭を 1 に
 * するのが要点で、実際の市内局番は 0 と 1 で始まらないので、どこにも繋がらない。
 *
 * @param areaCode 市外局番。先頭の 0 を含む
 * @param r 乱数列
 * @returns ハイフン区切りの番号
 */
export function landlineOf(areaCode: string, r: Random): string {
  const localLength = 10 - areaCode.length - 4;
  let local = "1";
  for (let i = 1; i < localLength; i++) {
    local += String(r.int(0, 9));
  }
  return `${areaCode}-${local}-${digits(r, 4)}`;
}

/**
 * 携帯電話番号を作る。
 *
 * 090-0XXX-XXXX。09000〜09009 は割り当てられていない帯。080-0 は 0800 のフリー
 * ダイヤルと衝突するので使わない。
 *
 * @param r 乱数列
 * @returns ハイフン区切りの番号
 */
export function mobileOf(r: Random): string {
  return `090-0${digits(r, 3)}-${digits(r, 4)}`;
}

/**
 * 指定した桁数の数字列。
 *
 * @param r 乱数列
 * @param n 桁数
 * @returns 0 埋めされた数字列
 */
function digits(r: Random, n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) {
    s += String(r.int(0, 9));
  }
  return s;
}

/**
 * 一人ぶんを作る。
 *
 * 乱数を引く順序を変えてはいけない。順序が変わると同じ seed でも別人になり、
 * スナップショットが崩れる。住所は乱数を使わずに選ぶので、遠隔地や離島に
 * 差し替えても名前や生年月日は変わらない。
 *
 * @param seed 人物の seed。0 が既定
 * @param constraint 都道府県と住所の選び方
 * @param today 年齢を数える基準日。省略時は現在
 * @returns 一人ぶんのダミーデータ
 */
export function generate(
  seed: number,
  constraint: Constraint = {},
  today: Date = new Date(),
): Person {
  const r = createRandom(seed);
  const address = pickAddress(seed, constraint);

  const sex: Sex = r.next() < 0.5 ? "male" : "female";
  const [family, familyKana] = r.pick(FAMILY);
  const [given, givenKana] = r.pick(sex === "male" ? GIVEN_MALE : GIVEN_FEMALE);

  // 21〜65 を引いて、誕生日がまだ来ていなければ 1 つ下がる。結果は 20〜65 に収まる。
  const years = r.int(21, 65);
  const birth = { y: today.getFullYear() - years, m: r.int(1, 12), d: r.int(1, 28) };
  const age = ageAt(birth, today);

  const block = `${r.int(1, 5)}-${r.int(1, 20)}-${r.int(1, 20)}`;
  const buildingName = `${address.town}ビル`;
  const room = `${r.int(2, 9)}0${r.int(1, 9)}`;
  const building = `${buildingName} ${room}`;
  const mobile = mobileOf(r);
  const landline = landlineOf(address.areaCode, r);

  const familyRomaji = toRomaji(familyKana);
  const givenRomaji = toRomaji(givenKana);
  // 乱数はここまでの順で引く。あとに足したので、前の値は 0.1.0 のまま。
  const corporateNumber = corporateNumberOf(r);

  return {
    seed,
    sex,
    family,
    given,
    familyKana,
    givenKana,
    familyRomaji,
    givenRomaji,
    address,
    block,
    building,
    buildingName,
    room,
    mobile,
    landline,
    email: `${givenRomaji}.${familyRomaji}.${seed}@example.jp`,
    username: `${familyRomaji}_${givenRomaji}_${seed}`,
    password: PASSWORD,
    birth,
    age,
    company: `${family}商事株式会社`,
    companyKana: `${familyKana}しょうじ`,
    department: "営業部",
    title: "課長",
    url: "https://example.jp/",
    corporateNumber,
    invoiceNumber: `T${corporateNumber}`,
    card: {
      number: CARD_NUMBER,
      brand: "visa",
      expMonth: 12,
      expYear: today.getFullYear() + 3,
      cvc: "123",
    },
  };
}

/**
 * 法人番号を作る。12 桁を乱数で引き、検査用数字を頭に付ける。
 *
 * @param r 乱数列
 * @returns 13 桁の法人番号
 */
export function corporateNumberOf(r: Random): string {
  const body = digits(r, 12);
  return `${checkDigit(body)}${body}`;
}

/**
 * 法人番号の検査用数字。国税庁の定めそのまま。
 *
 * 12 桁を最下位から数えて n 桁目を P_n とし、n が奇数なら 1、偶数なら 2 を掛けて足す。
 * その和を 9 で割った余りを 9 から引く。
 *
 * @param body 検査用数字を除いた 12 桁
 * @returns 検査用数字（1〜9）
 */
export function checkDigit(body: string): number {
  let sum = 0;
  for (let n = 1; n <= 12; n++) {
    sum += Number(body[12 - n]) * (n % 2 === 1 ? 1 : 2);
  }
  return 9 - (sum % 9);
}

/**
 * 満年齢。
 *
 * @param birth 生年月日
 * @param today 基準日
 * @returns 基準日での満年齢
 */
export function ageAt(birth: { y: number; m: number; d: number }, today: Date): number {
  const m = today.getMonth() + 1;
  const d = today.getDate();
  const before = m < birth.m || (m === birth.m && d < birth.d);
  return today.getFullYear() - birth.y - (before ? 1 : 0);
}
