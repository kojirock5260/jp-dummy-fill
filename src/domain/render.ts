import { analyze, type Features } from "./classify";
import { PREFECTURES, shortPref } from "./data/addresses";
import type { FieldInfo, FieldKind, FieldOption } from "./field";
import { hiraToKata, JAPANESE, kataToHira, toFullWidthDigits, toHalfWidthKana } from "./kana";
import type { Card, Person } from "./person";
import { ERAS, toWareki } from "./wareki";

/**
 * 欄種 × Person → 欄に入れる文字列。`docs/field-rules.md` §5 の実装。
 *
 * 値そのものは Person が持っている。ここでやるのは切り出しと整形で、
 * カナの文字種、全角・半角、ハイフンの有無、select の選択肢当てを欄の属性から決める。
 */

/** 欄種の判定結果のうち、値の整形に要るもの。 */
export type RenderContext = {
  /** 年齢や和暦の基準日。 */
  today: Date;
  /**
   * form にある欄種の集合。
   *
   * 住所の欄に何を入れるかは、隣に何の欄があるかで変わる。都道府県の select が
   * 無いフォームの「住所1」には都道府県から入れないと、住所が途中から始まる。
   * 建物の欄が無ければ、番地の後ろに建物を続ける。元号の欄があれば年は和暦。
   */
  kinds: ReadonlySet<FieldKind>;
};

export type KanaScript = "katakana" | "hiragana" | "halfwidth";

/** 何にも当たらなかった text 欄に入れる短い日本語。label が英語だけなら英語。 */
const SHORT_TEXT = "テスト入力";
const SHORT_TEXT_EN = "Test input";

/** 自由記述に入れる文。lorem ipsum は日本語のフォームでは浮くので使わない。 */
const MESSAGE =
  "テスト用の入力です。フォームの動作確認のため、自動で入力しています。この内容への返信は不要です。";
const MESSAGE_EN =
  "This is a test entry, filled automatically to check the form. No reply is needed.";

/**
 * label / placeholder が英語だけの欄か。
 *
 * 日本語のサイトでも、SNS のリンク欄や管理画面は英語のままのことがある。そこに
 * 「テスト入力」が入ると浮くので、英語の欄には英語を入れる。label が空の欄は日本語のまま。
 *
 * @param field 対象の欄
 * @returns 手掛かりの文字があり、そのどれも日本語でなければ `true`
 */
function isEnglishField(field: FieldInfo): boolean {
  const text = `${field.label}${field.placeholder}${field.ariaLabel}`.trim();
  return text !== "" && !JAPANESE.test(text);
}

/**
 * URL の欄に入れる値。placeholder が URL ならそのドメインの下にユーザー名を付ける。
 *
 * `https://facebook.com` と例示する欄は、そのドメインでないと弾くことがある。
 * 例が無ければ example.jp。
 *
 * @param person 人物
 * @param field 対象の欄
 * @returns URL
 */
function urlFor(person: Person, field: FieldInfo): string {
  const m = field.placeholder
    .trim()
    .normalize("NFKC")
    .match(/^(https?:\/\/[^/\s?#]+)/i);
  return m ? `${m[1]}/${person.username}` : person.url;
}

/** 選択肢の 1 行目にある「選んでください」の類。値としては選ばない。 */
const PLACEHOLDER_OPTION = /選択|選んで|select|choose|please|---|--|▼|未設定/i;

/**
 * select で候補が当たらなかったとき、先頭の選択肢で済ませてはいけない欄種。
 *
 * 住所・氏名・連絡先・生年月日の語が select に付いているなら、判定のほうが怪しい
 * （国の select が住所の語を持っていた）。先頭を選ぶと Albania を選ぶことになる。
 * それ以外（会社規模、部署、お問い合わせ内容、年代）は何を選んでも通る。
 */
const STRICT_SELECT: ReadonlySet<FieldKind> = new Set([
  "name_full",
  "name_family",
  "name_given",
  "name_romaji",
  "name_romaji_family",
  "name_romaji_given",
  "kana_full",
  "kana_family",
  "kana_given",
  "company_kana",
  "postal",
  "postal_1",
  "postal_2",
  "prefecture",
  "city",
  "town",
  "block",
  "building",
  "room",
  "country",
  "address_full",
  "address_kana",
  "prefecture_kana",
  "city_kana",
  "town_kana",
  "tel",
  "tel_1",
  "tel_2",
  "tel_3",
  "tel_12",
  "tel_23",
  "fax",
  "email",
  "email_confirm",
  "password",
  "password_confirm",
  "username",
  "card_number",
  "card_1",
  "card_2",
  "card_3",
  "card_4",
  "card_holder",
  "card_cvc",
  "corporate_number",
  "invoice_number",
  "url",
  "birth",
  "birth_y",
  "birth_m",
  "birth_d",
  "era",
  "gender",
]);

// ---------- 文字種 ----------

/**
 * カナ欄の文字種を決める（§5.1）。
 *
 * 1. label / placeholder にカタカナの語があればカタカナ、ひらがなの語があればひらがな
 * 2. 語で決まらなければ、label / placeholder の文字そのものを見る（「やまだ たろう」）
 * 3. name の語（`furigana` `hiragana` → ひらがな、`katakana` → カタカナ）
 * 4. pattern の文字範囲
 * 5. どれも無ければカタカナ。日本のフォームの多数派
 *
 * @param field 判定する欄
 * @returns 文字種
 */
export function kanaScript(field: FieldInfo): KanaScript {
  const fromLabel = analyze({ ...field, name: "", id: "", autocomplete: "" }).features;
  if (fromLabel.has("katakana")) {
    return "katakana";
  }
  if (fromLabel.has("hiragana")) {
    return "hiragana";
  }
  // 文字そのものを見るのは placeholder だけ。「やまだ たろう」のような例を読むため。
  // label は「お名前の読み」のように助詞のひらがなを必ず含むので、文字で見ると
  // 全部ひらがなになってしまう。label は上の語（フリガナ / ふりがな）で判定する。
  if (/[ァ-ヶ]/.test(field.placeholder)) {
    return "katakana";
  }
  if (/[ぁ-ゖ]/.test(field.placeholder)) {
    return "hiragana";
  }

  const fromName = analyze({ ...field, label: "", placeholder: "", ariaLabel: "" }).features;
  if (fromName.has("hiragana")) {
    return "hiragana";
  }
  if (fromName.has("katakana")) {
    return "katakana";
  }

  const p = field.pattern;
  if (/ｦ-ﾟ|\\uFF66-\\uFF9F/i.test(p)) {
    return "halfwidth";
  }
  if (/ァ-[ヶヺヴン]|\\u30A1-\\u30F/i.test(p)) {
    return "katakana";
  }
  if (/ぁ-[んゔゖ]|\\u3041-\\u309/i.test(p)) {
    return "hiragana";
  }
  return "katakana";
}

/**
 * ひらがなの読みを、欄の文字種にする。
 *
 * @param hiragana ひらがなの読み。カタカナが混ざっていてもよい
 * @param script 文字種
 * @returns 変換した文字列
 */
export function toScript(hiragana: string, script: KanaScript): string {
  switch (script) {
    case "katakana":
      return hiraToKata(hiragana);
    case "hiragana":
      return kataToHira(hiragana);
    case "halfwidth":
      return toHalfWidthKana(hiragana);
  }
}

/**
 * 姓と名の間の区切り。
 *
 * 既定は全角スペース。「スペースなし」「続けて」とあれば詰める。placeholder が
 * 半角スペースで区切っているなら（「やまだ たろう」）それに合わせる。
 *
 * @param field 対象の欄
 * @returns 区切り文字。無ければ空文字
 */
export function nameSeparator(field: FieldInfo): string {
  const hint = `${field.label} ${field.placeholder} ${field.ariaLabel}`;
  if (/スペース(なし|無し|不要)|続けて|詰めて|空けず/.test(hint)) {
    return "";
  }
  if (field.placeholder.includes(" ") && !field.placeholder.includes("　")) {
    return " ";
  }
  return "　";
}

/**
 * 数字を全角にするか（§5.2）。
 *
 * 「全角」と書いてあれば全角。ただし `inputmode="numeric"` `inputmode="tel"` や
 * 数字だけの pattern は半角確定なので、そちらが勝つ。
 *
 * @param field 対象の欄
 * @param f 欄から拾った特徴
 * @returns 全角にするなら `true`
 */
function wantsFullWidth(field: FieldInfo, f: Features): boolean {
  if (!f.has("zenkaku") || f.has("hankaku")) {
    return false;
  }
  if (field.inputmode === "numeric" || field.inputmode === "tel") {
    return false;
  }
  return !/\\d|\[0-9\]|０-９/.test(field.pattern) || /０-９/.test(field.pattern);
}

/**
 * 数字の列を欄の全角・半角に合わせる。
 *
 * @param s 半角の数字とハイフンから成る文字列
 * @param field 対象の欄
 * @param f 欄から拾った特徴
 * @returns 全角か半角に揃えた文字列
 */
function digitsFor(s: string, field: FieldInfo, f: Features): string {
  return wantsFullWidth(field, f) ? toFullWidthDigits(s) : s;
}

/**
 * ハイフン区切りで入れるか（§5.3）。
 *
 * placeholder に区切りがあれば有り、区切り無しの数字だけなら無し。maxlength が
 * 区切り付きの長さに足りなければ無し。pattern が桁数を決めていれば従う。
 * 何も無ければ有り。
 *
 * @param field 対象の欄
 * @param plain 区切り無しの長さ
 * @param hyphenated 区切り付きの長さ
 * @returns ハイフンを入れるなら `true`
 */
export function wantsHyphen(field: FieldInfo, plain: number, hyphenated: number): boolean {
  // 「ハイフン無し・半角数字」「ハイフン区切りで」のような指示が label にあれば従う。
  const text = `${field.label} ${field.placeholder} ${field.ariaLabel}`.normalize("NFKC");
  if (/ハイフン(なし|無し|不要|抜き|は?除|は?入れ(ず|ない))/.test(text)) {
    return false;
  }
  if (/ハイフン(あり|有り|付き|込み|区切り|を?含め|を?入れて)/.test(text)) {
    return true;
  }

  // placeholder の例（「例：5300001」「090-0000-0000」）。桁が合う数字の並びだけを見る。
  const ph = field.placeholder.normalize("NFKC");
  for (const run of ph.match(/[\d-]{3,}/g) ?? []) {
    const digits = run.replace(/-/g, "");
    if (digits.length !== plain) {
      continue;
    }
    return run.includes("-");
  }
  if (/[〒]/.test(ph)) {
    return true;
  }

  if (field.maxlength !== null) {
    return field.maxlength >= hyphenated;
  }
  if (field.pattern.includes(`{${plain}}`)) {
    return false;
  }
  return true;
}

/**
 * ハイフン区切りの番号を、欄に合わせて区切り有り無し・全角半角にする。
 *
 * @param hyphenated ハイフン区切りの番号
 * @param field 対象の欄
 * @param f 欄から拾った特徴
 * @returns 整形した番号
 */
function formatNumber(hyphenated: string, field: FieldInfo, f: Features): string {
  const plain = hyphenated.replace(/-/g, "");
  const s = wantsHyphen(field, plain.length, hyphenated.length) ? hyphenated : plain;
  return digitsFor(s, field, f);
}

// ---------- select ----------

/**
 * 表示テキストが「選んでください」の類か。
 *
 * @param o 選択肢
 * @returns 値として選ばないなら `true`
 */
export function isPlaceholderOption(o: FieldOption): boolean {
  return o.value.trim() === "" || PLACEHOLDER_OPTION.test(o.text);
}

/**
 * 候補の文字列に合う選択肢を探す（§5.4）。
 *
 * value の一致 → 表示テキストの一致 → 表示テキストの部分一致の順。部分一致は
 * 2 文字以上の数字以外に限る。「5」が「15」に当たると月がずれる。
 *
 * @param options 選択肢
 * @param candidates 当てたい文字列。優先順
 * @returns 合った選択肢の value。無ければ `null`
 */
export function pickOption(
  options: readonly FieldOption[],
  candidates: readonly string[],
): string | null {
  const norm = (s: string): string => s.trim().normalize("NFKC").toLowerCase();
  const wanted = candidates.map(norm).filter((c) => c !== "");
  const real = options.filter((o) => !isPlaceholderOption(o));

  for (const c of wanted) {
    const hit = real.find((o) => norm(o.value) === c);
    if (hit) {
      return hit.value;
    }
  }
  for (const c of wanted) {
    const hit = real.find((o) => norm(o.text) === c);
    if (hit) {
      return hit.value;
    }
  }
  for (const c of wanted) {
    if (c.length < 2 || /^\d+$/.test(c)) {
      continue;
    }
    const hit = real.find((o) => norm(o.text).includes(c) || norm(o.value).includes(c));
    if (hit) {
      return hit.value;
    }
  }
  return null;
}

/**
 * 「選んでください」を除いた先頭の選択肢。
 *
 * @param options 選択肢
 * @returns 先頭の value。全部が placeholder なら `null`
 */
function firstOption(options: readonly FieldOption[]): string | null {
  return options.find((o) => !isPlaceholderOption(o))?.value ?? null;
}

/**
 * 選択肢があれば候補から当て、無ければ（text 欄なら）先頭の候補をそのまま入れる。
 *
 * @param field 対象の欄
 * @param candidates 候補。優先順
 * @returns 入れる値。select で当たらなければ `null`
 */
function choose(field: FieldInfo, candidates: string[]): string | null {
  if (field.options.length > 0) {
    return pickOption(field.options, candidates);
  }
  return candidates[0] ?? null;
}

// ---------- 候補 ----------

/**
 * 都道府県の候補。「東京都」「東京」「13」「トウキョウト」。
 *
 * @param pref 都道府県名
 * @returns 候補。優先順
 */
function prefectureCandidates(pref: string): string[] {
  const p = PREFECTURES.find((x) => x.name === pref);
  const code = p ? String(p.code) : "";
  return [pref, shortPref(pref), code, code.padStart(2, "0"), p?.kana ?? ""];
}

/**
 * 性別の候補。
 *
 * @param sex 性別
 * @returns 候補。優先順
 */
function genderCandidates(sex: Person["sex"]): string[] {
  return sex === "male"
    ? ["男性", "男", "male", "m", "man", "1", "おとこ"]
    : ["女性", "女", "female", "f", "woman", "2", "おんな"];
}

/**
 * 月や日の候補。「5」「05」「5月」。
 *
 * @param n 月か日
 * @param unit 「月」か「日」
 * @returns 候補。優先順
 */
function dayCandidates(n: number, unit: string): string[] {
  const s = String(n);
  return [s, s.padStart(2, "0"), `${s}${unit}`];
}

/**
 * 年の候補。元号の欄があるフォームでは和暦を先に、西暦を後ろに置く。
 *
 * 西暦も残しておくのは、元号の欄はあるのに年の select が西暦で並んでいる
 * フォームがあるため。和暦が当たらなければ西暦で当たる。
 *
 * @param person 人物
 * @param wareki 和暦で入れるか
 * @returns 候補。優先順
 */
function yearCandidates(person: Person, wareki: boolean): string[] {
  const { y, m, d } = person.birth;
  const western = [String(y), `${y}年`];
  if (!wareki) {
    return western;
  }
  const w = toWareki(y, m, d);
  if (!w) {
    return western;
  }
  const n = String(w.year);
  return [
    n,
    n.padStart(2, "0"),
    `${n}年`,
    `${w.era.name}${n}年`,
    `${w.era.initial}${n}`,
    ...western,
  ];
}

/**
 * 日付を 1 つの text に入れる書式。placeholder に従う（§5.3）。生年月日と希望日で共用。
 *
 * @param date 年月日
 * @param field 対象の欄
 * @returns 書式を整えた日付
 */
function dateText(date: { y: number; m: number; d: number }, field: FieldInfo): string {
  const { y, m, d } = date;
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  if (field.type === "date") {
    return `${y}-${mm}-${dd}`;
  }
  const ph = field.placeholder.normalize("NFKC");
  if (/年/.test(ph)) {
    return `${y}年${m}月${d}日`;
  }
  if (field.maxlength === 8 || /^\d{8}$/.test(ph)) {
    return `${y}${mm}${dd}`;
  }
  // 「年月日をハイフン区切りで」のような指示は aria-label や label に書かれる。
  const text = `${field.label} ${field.ariaLabel}`;
  const sep = /-/.test(ph)
    ? "-"
    : /\./.test(ph)
      ? "."
      : /ハイフン/.test(text)
        ? "-"
        : /スラッシュ/.test(text)
          ? "/"
          : /ピリオド|ドット/.test(text)
            ? "."
            : "/";
  // 「yyyy/m/d」や「1990/5/14」のように月日が 1 桁で示されていれば 0 埋めしない。
  const parts = ph
    .replace(/y{4}|\d{4}/i, "")
    .split(/[^a-z0-9]+/i)
    .filter((p) => p !== "");
  const padded = parts.every((p) => p.length === 2);
  return padded ? `${y}${sep}${mm}${sep}${dd}` : `${y}${sep}${m}${sep}${d}`;
}

// ---------- 希望日・ローマ字・カード ----------

/**
 * 希望日。基準日の 7 日後、土日なら次の月曜。
 *
 * 配達希望日や来店予約の欄は「明日以降」「3 日後以降」の制限を持つことが多く、
 * 1 週間後ならたいてい通る。土日を避けるのは定休日で弾かれないため。
 *
 * @param today 基準日
 * @returns 年月日
 */
export function futureDate(today: Date): { y: number; m: number; d: number } {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
  if (t.getDay() === 6) {
    t.setDate(t.getDate() + 2);
  } else if (t.getDay() === 0) {
    t.setDate(t.getDate() + 1);
  }
  return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() };
}

/**
 * ローマ字の氏名。並びと大文字小文字を欄の例に合わせる。
 *
 * 既定は「名 姓」を大文字で（SHOU ABE）。カードの名義がこの並びで、ローマ字欄の例も
 * 「TARO YAMADA」が多数派。例が「YAMADA TARO」や「姓 名」なら姓を先に、
 * 「Taro Yamada」のように小文字を含むなら頭だけ大文字にする。
 *
 * @param person 人物
 * @param field 対象の欄
 * @returns ローマ字の氏名
 */
export function romajiName(person: Person, field: FieldInfo): string {
  const hint = `${field.label} ${field.placeholder} ${field.ariaLabel}`.normalize("NFKC");
  const familyFirst =
    /(yamada|suzuki|satou?|tanaka)\s+(tarou?|hanako|ichirou?)/i.test(hint) ||
    /(family|last|sur)\s*name.{0,12}(given|first)\s*name|姓.{0,4}名/.test(hint);
  const parts = familyFirst
    ? [person.familyRomaji, person.givenRomaji]
    : [person.givenRomaji, person.familyRomaji];
  return parts.map((p) => romajiCase(p, field)).join(" ");
}

/**
 * ローマ字の大文字小文字。例に小文字があれば頭だけ大文字、無ければ全部大文字。
 *
 * @param word 小文字のローマ字
 * @param field 対象の欄
 * @returns 欄の例に合わせた語
 */
function romajiCase(word: string, field: FieldInfo): string {
  if (/[a-z]/.test(field.placeholder)) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }
  return word.toUpperCase();
}

/**
 * カード番号の区切り。例に「4242 4242」があれば空白、「4242-4242」ならハイフン。
 * 例が無ければ maxlength が 19 以上のときだけ空白で区切る。16 桁ちょうどの欄には入らない。
 *
 * @param number 16 桁の番号
 * @param field 対象の欄
 * @returns 欄に合わせた番号
 */
function cardNumberText(number: string, field: FieldInfo): string {
  const ph = field.placeholder.normalize("NFKC");
  const example = ph.match(/\d{4}([ -])\d{4}/);
  const sep = example ? example[1] : field.maxlength !== null && field.maxlength >= 19 ? " " : "";
  return sep === "" ? number : (number.match(/.{1,4}/g) ?? [number]).join(sep);
}

/**
 * 有効期限を 1 つの欄に。既定は MM/YY。
 *
 * `type=month` は YYYY-MM と決まっている。それ以外は例に従う。「MM/YYYY」「20YY」や
 * maxlength 7 以上なら西暦 4 桁、例で年が先（YY/MM）なら年を先に。区切りは例の文字。
 * 例が「MMYY」のように区切り無し、または maxlength が 4 なら区切り無し。
 *
 * @param card カード
 * @param field 対象の欄
 * @returns 欄に合わせた有効期限
 */
function cardExpiryText(card: Card, field: FieldInfo): string {
  const mm = String(card.expMonth).padStart(2, "0");
  const yyyy = String(card.expYear);
  if (field.type === "month") {
    return `${yyyy}-${mm}`;
  }
  const ph = field.placeholder.normalize("NFKC").toLowerCase();
  const long = /yyyy|20\d\d/.test(ph) || (field.maxlength !== null && field.maxlength >= 7);
  const y = long ? yyyy : yyyy.slice(2);
  const example = ph.match(/[my\d]([/\-. ])[my\d]/);
  const compact =
    (/m/.test(ph) && /y/.test(ph)) || (field.maxlength !== null && field.maxlength <= 4);
  const sep = example ? example[1] : compact ? "" : "/";
  const yearFirst = ph.includes("y") && ph.includes("m") && ph.indexOf("y") < ph.indexOf("m");
  return yearFirst ? `${y}${sep}${mm}` : `${mm}${sep}${y}`;
}

/**
 * 有効期限の年の候補。maxlength が 2 か例が 2 桁なら 2 桁を先に、それ以外は 4 桁を先に。
 *
 * @param card カード
 * @param field 対象の欄
 * @returns 候補。優先順
 */
function cardYearCandidates(card: Card, field: FieldInfo): string[] {
  const yyyy = String(card.expYear);
  const yy = yyyy.slice(2);
  const ph = field.placeholder.normalize("NFKC").toLowerCase().trim();
  const short = field.maxlength === 2 || /^(yy|\d{2})$/.test(ph);
  return short ? [yy, yyyy, `${yyyy}年`] : [yyyy, yy, `${yyyy}年`];
}

// ---------- 住所 ----------

/**
 * 町名・番地の欄に入れる文字列。
 *
 * 都道府県と市区町村の欄がフォームにあればその先だけ。無い欄のぶんは前に足す。
 * 建物の欄が無ければ後ろに建物も足す。
 *
 * @param person 人物
 * @param ctx form にある欄種
 * @returns 町名・番地（と、必要なら都道府県・市区町村・建物）
 */
function townValue(person: Person, ctx: RenderContext): string {
  const a = person.address;
  // 番地だけの欄が別にあれば、ここは町名まで。
  let s = ctx.kinds.has("block") ? a.town : `${a.town}${person.block}`;
  if (!ctx.kinds.has("city")) {
    s = `${a.city}${s}`;
    if (!ctx.kinds.has("prefecture")) {
      s = `${a.pref}${s}`;
    }
  }
  return ctx.kinds.has("building") ? s : `${s} ${person.building}`;
}

/**
 * 住所全体。建物の欄が無ければ建物まで。
 *
 * @param person 人物
 * @param ctx form にある欄種
 * @returns 都道府県から番地（と建物）まで
 */
function fullAddress(person: Person, ctx: RenderContext): string {
  const a = person.address;
  const s = `${a.pref}${a.city}${a.town}${person.block}`;
  return ctx.kinds.has("building") ? s : `${s} ${person.building}`;
}

/**
 * 番地追記の材料（spec §3 の 7b）。
 *
 * 郵便番号から住所を補完するライブラリは町域までしか入れない。補完のあとで
 * 町域で終わっている住所欄に、番地（建物の欄が無ければ建物も）を足す。
 *
 * @param person 人物
 * @param kinds form にある欄種
 * @returns `endsWith` で終わる値の末尾に `add` を足す
 */
export function appendix(
  person: Person,
  kinds: ReadonlySet<FieldKind>,
): {
  endsWith: string;
  add: string;
} {
  return {
    endsWith: person.address.town,
    add: kinds.has("building") ? person.block : `${person.block} ${person.building}`,
  };
}

// ---------- 本体 ----------

/**
 * 欄種と人物から、欄に入れる値を作る。
 *
 * `null` は「触らない」。触らない欄種のほか、select で合う選択肢が無いときも `null`。
 * 合わないものを無理に選ぶより、空のまま残して人に見せるほうがよい。
 *
 * checkbox（`agree`）は文字列に意味が無い。`"on"` を返し、書く側が checked にする。
 * radio と select は選択肢の value を返す。
 *
 * @param kind 欄種
 * @param person 人物
 * @param field 対象の欄
 * @param ctx 基準日と、form にある欄種
 * @returns 入れる値。触らないなら `null`
 */
export function render(
  kind: FieldKind,
  person: Person,
  field: FieldInfo,
  ctx: RenderContext,
): string | null {
  const value = renderValue(kind, person, field, ctx);
  const listed = value !== null && field.options.some((o) => o.value === value);
  // select に文字列は入れられない。「お問い合わせ内容」が select だったときのように、
  // 欄種が自由記述でも選択肢の中から選ぶしかないので、当たらなければ先頭にする。
  // 先頭に落とすのは「何でもよい」欄種だけ。住所や名前の欄種が select に当たったなら
  // 判定のほうが怪しく、先頭を選ぶと国の select で Albania を選ぶようなことになる。
  if (value !== null && field.tag === "select" && !listed) {
    return STRICT_SELECT.has(kind) ? null : firstOption(field.options);
  }
  // radio は「先頭を選ぶ」が既定（§2.8）。性別のように候補で当てるものも、
  // 当たらなければ先頭。触らない欄種だけは何も選ばない。
  if (field.type === "radio" && !listed && kind !== "skip" && kind !== "checkbox") {
    return firstOption(field.options);
  }
  return value;
}

/**
 * 欄種ごとの値そのもの。select への当て直しは {@link render} が行う。
 *
 * @param kind 欄種
 * @param person 人物
 * @param field 対象の欄
 * @param ctx 基準日と、form にある欄種
 * @returns 入れる値。触らないなら `null`
 */
function renderValue(
  kind: FieldKind,
  person: Person,
  field: FieldInfo,
  ctx: RenderContext,
): string | null {
  const f = analyze(field).features;
  const a = person.address;

  switch (kind) {
    case "name_full":
      return `${person.family}${nameSeparator(field)}${person.given}`;
    case "name_family":
      return person.family;
    case "name_given":
      return person.given;
    case "name_romaji":
      return romajiName(person, field);
    case "name_romaji_family":
      return romajiCase(person.familyRomaji, field);
    case "name_romaji_given":
      return romajiCase(person.givenRomaji, field);

    case "kana_full": {
      const s = kanaScript(field);
      return `${toScript(person.familyKana, s)}${nameSeparator(field)}${toScript(person.givenKana, s)}`;
    }
    case "kana_family":
      return toScript(person.familyKana, kanaScript(field));
    case "kana_given":
      return toScript(person.givenKana, kanaScript(field));
    case "company_kana":
      return toScript(person.companyKana, kanaScript(field));

    case "postal":
      return formatNumber(a.zip, field, f);
    case "postal_1":
      return digitsFor(a.zip.slice(0, 3), field, f);
    case "postal_2":
      return digitsFor(a.zip.slice(4), field, f);

    case "prefecture":
      return choose(field, prefectureCandidates(a.pref));
    case "city": {
      // 番地だけの欄が別にあり、町名の欄が無いなら、町名はここに入る（Amazon の「〇〇市〇〇町」）。
      const city = ctx.kinds.has("block") && !ctx.kinds.has("town") ? `${a.city}${a.town}` : a.city;
      return field.options.length > 0 ? pickOption(field.options, [a.city, city]) : city;
    }
    case "town":
      return townValue(person, ctx);
    case "block":
      return digitsFor(person.block, field, f);
    case "building":
      // 部屋番号の欄が別にあれば建物名だけ。
      return ctx.kinds.has("room") ? person.buildingName : person.building;
    case "room":
      return person.room;
    case "country":
      return choose(field, ["日本", "Japan", "JP", "JPN", "日本国", "392"]);
    case "address_full":
      return fullAddress(person, ctx);

    case "address_kana":
      return toScript(`${a.prefKana}${a.cityKana}${a.townKana}${person.block}`, kanaScript(field));
    case "prefecture_kana":
      return toScript(a.prefKana, kanaScript(field));
    case "city_kana":
      return toScript(a.cityKana, kanaScript(field));
    case "town_kana":
      return toScript(`${a.townKana}${person.block}`, kanaScript(field));

    case "tel":
      return formatNumber(phoneFor(person, f), field, f);
    case "tel_1":
    case "tel_2":
    case "tel_3":
    case "tel_12":
    case "tel_23":
      return digitsFor(phonePart(phoneFor(person, f), kind), field, f);
    case "fax":
      return formatNumber(person.landline, field, f);

    case "email":
    case "email_confirm":
      return person.email;
    case "password":
    case "password_confirm":
      return person.password;
    case "username":
      return person.username;

    case "card_number":
      return cardNumberText(person.card.number, field);
    case "card_1":
    case "card_2":
    case "card_3":
    case "card_4": {
      const n = Number(kind.slice(-1)) - 1;
      return person.card.number.slice(n * 4, n * 4 + 4);
    }
    case "card_holder":
      return romajiName(person, field);
    case "card_expiry":
      return cardExpiryText(person.card, field);
    case "card_expiry_month": {
      const m = person.card.expMonth;
      return choose(field, [String(m).padStart(2, "0"), String(m), `${m}月`]);
    }
    case "card_expiry_year":
      return choose(field, cardYearCandidates(person.card, field));
    case "card_cvc":
      // American Express は 4 桁。
      return field.maxlength === 4 ? "1234" : person.card.cvc;
    case "card_brand":
      return field.options.length > 0
        ? (pickOption(field.options, ["visa", "ビザ"]) ?? firstOption(field.options))
        : "VISA";

    case "birth":
      return dateText(person.birth, field);
    case "birth_y":
      return choose(field, yearCandidates(person, ctx.kinds.has("era")));
    case "birth_m":
      return choose(field, dayCandidates(person.birth.m, "月"));
    case "birth_d":
      return choose(field, dayCandidates(person.birth.d, "日"));
    case "era": {
      const w = toWareki(person.birth.y, person.birth.m, person.birth.d);
      const era = w?.era ?? ERAS[0];
      return choose(field, [era.name, era.initial, String(era.code), era.name[0]]);
    }
    case "age":
      return choose(field, [String(person.age), `${person.age}歳`]);
    case "gender":
      return choose(field, genderCandidates(person.sex));
    case "date_future":
      // 日付の select（「9月24日(木)」の並び）は候補を作れないので、先頭の日で済ませる。
      return field.options.length > 0
        ? firstOption(field.options)
        : dateText(futureDate(ctx.today), field);

    case "company":
      return person.company;
    case "department":
      return field.options.length > 0
        ? (pickOption(field.options, [person.department]) ?? firstOption(field.options))
        : person.department;
    case "job_title":
      return field.options.length > 0
        ? (pickOption(field.options, [person.title]) ?? firstOption(field.options))
        : person.title;
    case "corporate_number":
      return digitsFor(person.corporateNumber, field, f);
    case "invoice_number":
      return person.invoiceNumber;
    case "url":
      return urlFor(person, field);

    case "message":
      return isEnglishField(field) ? MESSAGE_EN : MESSAGE;
    case "agree":
      return "on";
    case "number": {
      const lo = field.min ?? 1;
      const hi = field.max ?? Math.max(lo, 100);
      return String(lo + ((person.seed * 7 + 3) % (hi - lo + 1)));
    }
    case "select":
    case "radio":
      return firstOption(field.options);
    case "text":
      return isEnglishField(field) ? SHORT_TEXT_EN : SHORT_TEXT;
    case "checkbox":
    case "skip":
      return null;
  }
}

/**
 * 電話の欄に入れる番号。携帯が既定で、「固定」「自宅」とあれば固定電話（§2.4）。
 *
 * @param person 人物
 * @param f 欄から拾った特徴
 * @returns ハイフン区切りの番号
 */
function phoneFor(person: Person, f: Features): string {
  return f.has("home") && !f.has("mobile") ? person.landline : person.mobile;
}

/**
 * ハイフン区切りの番号から、分割欄のぶんを切り出す。
 *
 * @param hyphenated 「090-0123-4567」のような番号
 * @param kind どの部分か
 * @returns その部分。`tel_12` `tel_23` はハイフンを挟んだ 2 つ分
 */
export function phonePart(hyphenated: string, kind: FieldKind): string {
  const [p1 = "", p2 = "", p3 = ""] = hyphenated.split("-");
  switch (kind) {
    case "tel_1":
      return p1;
    case "tel_2":
      return p2;
    case "tel_3":
      return p3;
    case "tel_12":
      return `${p1}-${p2}`;
    case "tel_23":
      return `${p2}-${p3}`;
    default:
      return hyphenated;
  }
}
