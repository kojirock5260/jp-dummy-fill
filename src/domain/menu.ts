import type { FieldKind } from "./field";

/**
 * 「この欄にデータを埋める」のパレットに並べる欄種。
 *
 * 欄種を 7 つのまとまりに分けて見出しを付ける。並び順は日本のフォームで欄が出てくる順
 * （氏名 → 住所 → 連絡先 → 生年月日 → 会社）。パレットは入力で絞り込めるので、
 * 見出しは探すためではなく、絞り込む前の一覧を読みやすくするためのもの。
 *
 * ここに無い欄種は、選ばせても意味が無いもの。`email_confirm` は `email` と同じ値、
 * `tel_12` `tel_23` は稀、`radio` `checkbox` `skip` は「入れる」ものではない。
 *
 * 表示名は `public/_locales` の `group_<id>` と `kind_<kind>`。domain は文字列を持たず、
 * 引くのは content.ts の仕事。
 */
export type MenuGroup = {
  id: string;
  kinds: readonly FieldKind[];
};

export const MENU_GROUPS: readonly MenuGroup[] = [
  {
    id: "name",
    kinds: [
      "name_full",
      "name_family",
      "name_given",
      "kana_full",
      "kana_family",
      "kana_given",
      "name_romaji",
      "name_romaji_family",
      "name_romaji_given",
    ],
  },
  {
    id: "address",
    kinds: [
      "postal",
      "postal_1",
      "postal_2",
      "prefecture",
      "city",
      "town",
      "block",
      "building",
      "room",
      "address_full",
      "address_kana",
      "country",
    ],
  },
  {
    id: "contact",
    kinds: ["tel", "tel_1", "tel_2", "tel_3", "fax", "email", "password", "username", "url"],
  },
  {
    id: "birth",
    kinds: ["birth", "birth_y", "birth_m", "birth_d", "era", "age", "gender", "date_future"],
  },
  {
    id: "company",
    kinds: [
      "company",
      "company_kana",
      "department",
      "job_title",
      "corporate_number",
      "invoice_number",
    ],
  },
  {
    id: "payment",
    kinds: [
      "card_number",
      "card_holder",
      "card_expiry",
      "card_expiry_month",
      "card_expiry_year",
      "card_cvc",
      "card_brand",
    ],
  },
  {
    id: "other",
    kinds: ["message", "text", "number", "agree", "select"],
  },
];

/**
 * 絞り込みに使う読み。表示名は漢字なので、「しく」と打って「市区町村」を残すには読みが要る。
 *
 * ひらがなで書く。パレットがひらがなとカタカナを揃えて照合するので、どちらで打っても当たる。
 * 英語も少し入れてある。name 属性に慣れた人は `zip` `tel` と打つ。
 */
export const ALIASES: Record<string, readonly string[]> = {
  name_full: ["しめい", "なまえ", "name"],
  name_family: ["せい", "みょうじ", "family", "last"],
  name_given: ["めい", "なまえ", "given", "first"],
  kana_full: ["ふりがな", "かな", "しめい", "kana"],
  kana_family: ["ふりがな", "せい", "かな", "kana"],
  kana_given: ["ふりがな", "めい", "かな", "kana"],
  postal: ["ゆうびんばんごう", "zip", "postal"],
  postal_1: ["ゆうびんばんごう", "まえ3けた", "zip1"],
  postal_2: ["ゆうびんばんごう", "あと4けた", "zip2"],
  prefecture: ["とどうふけん", "けん", "pref"],
  city: ["しくちょうそん", "し", "city"],
  town: ["ちょうめい", "ばんち", "まち", "town"],
  block: ["ばんち", "ちょうめ", "block"],
  building: ["たてもの", "びる", "まんしょん", "building"],
  room: ["へやばんごう", "ごうしつ", "room"],
  address_full: ["じゅうしょ", "address"],
  address_kana: ["じゅうしょ", "ふりがな", "かな"],
  country: ["くに", "country"],
  tel: ["でんわ", "けいたい", "tel", "phone"],
  tel_1: ["でんわ", "しがいきょくばん", "tel1"],
  tel_2: ["でんわ", "しないきょくばん", "tel2"],
  tel_3: ["でんわ", "かにゅうしゃばんごう", "tel3"],
  fax: ["ふぁっくす", "fax"],
  email: ["めーる", "mail", "email"],
  password: ["ぱすわーど", "pass", "password"],
  username: ["ゆーざーめい", "あいでぃー", "id", "login", "user"],
  url: ["ゆーあーるえる", "ほーむぺーじ", "url"],
  birth: ["せいねんがっぴ", "たんじょうび", "birth"],
  birth_y: ["ねん", "year"],
  birth_m: ["つき", "がつ", "month"],
  birth_d: ["ひ", "にち", "day"],
  era: ["げんごう", "われき", "era"],
  age: ["ねんれい", "age"],
  gender: ["せいべつ", "gender", "sex"],
  company: ["かいしゃめい", "きぎょう", "company"],
  company_kana: ["かいしゃめい", "ふりがな", "company"],
  department: ["ぶしょ", "department"],
  job_title: ["やくしょく", "title"],
  name_romaji: ["ろーまじ", "えいじ", "romaji", "english"],
  name_romaji_family: ["ろーまじ", "せい", "romaji", "last"],
  name_romaji_given: ["ろーまじ", "めい", "romaji", "first"],
  date_future: ["きぼうび", "はいたつ", "よやく", "date"],
  corporate_number: ["ほうじんばんごう", "corporate"],
  invoice_number: ["いんぼいす", "とうろくばんごう", "てきかく", "invoice"],
  card_number: ["かーど", "くれじっと", "card", "credit"],
  card_holder: ["かーど", "めいぎ", "holder"],
  card_expiry: ["かーど", "ゆうこうきげん", "expiry", "exp"],
  card_expiry_month: ["かーど", "ゆうこうきげん", "つき", "month"],
  card_expiry_year: ["かーど", "ゆうこうきげん", "ねん", "year"],
  card_cvc: ["かーど", "せきゅりてぃこーど", "cvc", "cvv"],
  card_brand: ["かーど", "かーどがいしゃ", "ぶらんど", "brand", "visa"],
  message: ["じゆうきじゅつ", "ほんぶん", "といあわせ", "message"],
  text: ["てきすと", "text"],
  number: ["すうち", "かず", "number"],
  agree: ["どうい", "ちぇっく", "agree"],
  select: ["せんたくし", "さきとう", "select"],
};

/** メニューから選べる欄種の集合。受け取った文字列の検証に使う。 */
export const MENU_KINDS: ReadonlySet<FieldKind> = new Set(MENU_GROUPS.flatMap((g) => g.kinds));

/**
 * メニューから来た文字列が選べる欄種か。
 *
 * メニューの id は文字列なので、型では守れない。ここで絞ってから渡す。
 *
 * @param s メニューの id から切り出した文字列
 * @returns 選べる欄種なら `true`
 */
export function isMenuKind(s: string): s is FieldKind {
  return (MENU_KINDS as ReadonlySet<string>).has(s);
}
