/**
 * 欄の情報と欄種。presentation が DOM から作り、domain が読む。
 *
 * ここに DOM の型は出てこない。要素そのものではなく、判定に要る属性だけを
 * 抜き出した形にしておくことで、判定の全部を素の Node でテストできる。
 */

export type FieldTag = "input" | "select" | "textarea";

/** `<select>` の選択肢、または radio グループの各ボタン。 */
export type FieldOption = {
  value: string;
  /** 表示テキスト。radio なら結び付いた label の文字。 */
  text: string;
};

export type FieldInfo = {
  /** DOM 順。分割欄が隣り合っているかを見るのに使う。 */
  index: number;
  tag: FieldTag;
  /** input の type。select / textarea は空文字。 */
  type: string;
  name: string;
  id: string;
  autocomplete: string;
  inputmode: string;
  pattern: string;
  maxlength: number | null;
  /** `type=number` の下限と上限。無ければ `null`。 */
  min: number | null;
  max: number | null;
  /** `for=` / `aria-labelledby` / 包む label / 直前テキスト を連結したもの。 */
  label: string;
  placeholder: string;
  ariaLabel: string;
  /** select の選択肢、radio グループのボタン。それ以外は空配列。 */
  options: FieldOption[];
  /** radio / checkbox で選ばれているか。 */
  checked: boolean;
  /**
   * 今の値。select は選ばれている option の value、radio グループは選ばれている
   * ボタンの value。都道府県が既に選ばれているかを見るのに使う。
   */
  value: string;
  /** 既に値があるか。書き込みの直前にも DOM で見直すので、ここは判定の参考まで。 */
  hasValue: boolean;
  visible: boolean;
};

/**
 * 欄種。`docs/field-rules.md` §2 の各行に対応する。
 *
 * `tel_12` と `tel_23` は電話を 2 分割するフォームのためのもの（§3）。
 * 「090-1234 / 5678」か「090 / 1234-5678」かの違いで、3 分割の部分名では表せない。
 *
 * `block` `room` `country` は §2 の表に無い。Amazon の住所追加（市区町村 / 丁目・番地・号 /
 * 建物名 / 部屋番号 / 国）を見て足した。`block` は番地だけ、`room` は部屋番号だけの欄。
 *
 * `skip` は触らない欄（§2.9）。判定の結果として返すことで、呼び出し側が
 * 「この欄には値が無い」と「触ってはいけない」を区別できる。
 */
export type FieldKind =
  | "name_full"
  | "name_family"
  | "name_given"
  | "kana_full"
  | "kana_family"
  | "kana_given"
  | "company_kana"
  | "postal"
  | "postal_1"
  | "postal_2"
  | "prefecture"
  | "city"
  | "town"
  | "building"
  | "block"
  | "room"
  | "country"
  | "address_full"
  | "address_kana"
  | "prefecture_kana"
  | "city_kana"
  | "town_kana"
  | "tel"
  | "tel_1"
  | "tel_2"
  | "tel_3"
  | "tel_12"
  | "tel_23"
  | "fax"
  | "email"
  | "email_confirm"
  | "password"
  | "password_confirm"
  | "username"
  | "birth"
  | "birth_y"
  | "birth_m"
  | "birth_d"
  | "era"
  | "age"
  | "gender"
  | "company"
  | "department"
  | "job_title"
  | "url"
  | "message"
  | "agree"
  | "number"
  | "select"
  | "radio"
  | "checkbox"
  | "text"
  | "skip";

/**
 * 住所に属する欄種。「住所を遠隔地・離島に替える」が書き直す範囲。
 *
 * FAX も入っている。固定電話は市外局番が住所に付いていくので、住所が変われば変わる。
 * 携帯は変わらないので `tel` は入れない。
 */
export const ADDRESS_KINDS: ReadonlySet<FieldKind> = new Set<FieldKind>([
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
  "prefecture_kana",
  "city_kana",
  "town_kana",
  "fax",
]);

/**
 * 空の FieldInfo。テストや部分的な情報からの組み立てに使う。
 *
 * @param over 埋めたい項目
 * @returns 残りを既定値で埋めた FieldInfo
 */
export function fieldInfo(over: Partial<FieldInfo> = {}): FieldInfo {
  return {
    index: 0,
    tag: "input",
    type: "text",
    name: "",
    id: "",
    autocomplete: "",
    inputmode: "",
    pattern: "",
    maxlength: null,
    min: null,
    max: null,
    label: "",
    placeholder: "",
    ariaLabel: "",
    options: [],
    checked: false,
    value: "",
    hasValue: false,
    visible: true,
    ...over,
  };
}
