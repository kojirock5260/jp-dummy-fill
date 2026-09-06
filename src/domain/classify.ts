import type { FieldInfo, FieldKind, FieldOption } from "./field";

/**
 * 欄種の判定。`docs/field-rules.md` §1〜§2 の実装。
 *
 * 方針は「どの語が見えたか」を特徴の集合に落とし、集合から欄種を決めること。
 * 語と欄種を 1 対 1 の表にすると `sei_kana` のような組み合わせが表の外に出るが、
 * 特徴の集合にしておけば「kana があれば氏名系よりカナ系」という優先を 1 箇所で
 * 書ける。
 *
 * シグナルは §1 の順に見る。上のものが欄種を出したら、下は見ない。
 * 例外はカナと確認の 2 つで、どのシグナルにあっても上の結果に被せる。
 * `autocomplete="family-name"` は Chrome の流儀でカナ欄にも付くので、name か
 * label にカナの語があれば `kana_family` に寄せないと、姓の漢字を 2 回入れることになる。
 */

/**
 * name / id から見つけた語。
 *
 * `[]` `-` `_` `.` と camelCase の境で切り、小文字にしたもの。
 * 末尾の数字は分割の番号として別に持つ（`zip1` → `zip` と 1）。
 */
export type Tokens = {
  words: string[];
  idx: number | null;
};

/**
 * 語から読み取れる特徴。欄種そのものではなく、欄種を決めるための材料。
 *
 * `part1`〜`part3` は分割欄の何番目かを語で示しているもの（`zip_upper` `tel_area`）。
 * `hiragana` `katakana` `zenkaku` `hankaku` `mobile` `home` は欄種には関わらず、
 * 文字種や書式の判定（§5）で使う。ここで一緒に拾っておくと、render 側でもう一度
 * 語を読まずに済む。
 */
export type Feature =
  | "kana"
  | "hiragana"
  | "katakana"
  | "family"
  | "given"
  | "fullname"
  | "company"
  | "confirm"
  | "address"
  | "postal"
  | "pref"
  | "city"
  | "town"
  | "building"
  | "room"
  | "country"
  | "tel"
  | "mobile"
  | "home"
  | "fax"
  | "email"
  | "password"
  | "username"
  | "birth"
  | "year"
  | "month"
  | "day"
  | "era"
  | "age"
  | "gender"
  | "department"
  | "title"
  | "url"
  | "message"
  | "subject"
  | "agree"
  | "zenkaku"
  | "hankaku"
  | "skip"
  | "part1"
  | "part2"
  | "part3";

export type Features = ReadonlySet<Feature>;

// ---------- name / id ----------

/**
 * 数字を剥がしてはいけない語。
 *
 * `address_line1` の `line1` は分割番号ではなく autocomplete 由来の語で、剥がすと
 * `address` + 1 になる。町名になるので結果は同じだが、`address_level1`（都道府県）が
 * 同じ道筋で町名に化けるので、両方とも守る。
 */
const KEEP_DIGITS = new Set(["line1", "line2", "line3", "level1", "level2", "level3", "level4"]);

/**
 * name や id を語に分ける。
 *
 * @param raw 属性の値そのまま
 * @returns 小文字の語と、末尾にあった分割番号
 */
export function tokenize(raw: string): Tokens {
  const words = raw
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 0);

  let idx: number | null = null;
  const last = words[words.length - 1];
  if (last !== undefined) {
    if (/^\d+$/.test(last)) {
      idx = Number(last);
      words.pop();
    } else if (!KEEP_DIGITS.has(last)) {
      const m = /^([a-z]+)(\d+)$/.exec(last);
      if (m) {
        idx = Number(m[2]);
        words[words.length - 1] = m[1];
      }
    }
  }

  // 途中の語に付いた数字（`address1_kana` の 1）。知っている語に付いているときだけ
  // 剥がす。`utf8` や `h1` の数字は分割番号ではない。
  for (let i = 0; i < words.length - 1; i++) {
    const m = /^([a-z]+)(\d+)$/.exec(words[i]);
    if (m && WORDS[m[1]] !== undefined && !KEEP_DIGITS.has(words[i])) {
      words[i] = m[1];
      idx ??= Number(m[2]);
    }
  }
  return { words, idx };
}

/** 1 語で決まる特徴。 */
const WORDS: Record<string, Feature[]> = {
  kana: ["kana"],
  furigana: ["kana", "hiragana"],
  hurigana: ["kana", "hiragana"],
  yomi: ["kana"],
  yomigana: ["kana"],
  ruby: ["kana"],
  phonetic: ["kana"],
  hiragana: ["kana", "hiragana"],
  katakana: ["kana", "katakana"],
  namekana: ["kana", "fullname"],
  seikana: ["kana", "family"],
  kanasei: ["kana", "family"],
  meikana: ["kana", "given"],
  kanamei: ["kana", "given"],

  sei: ["family"],
  last: ["family"],
  lastname: ["family"],
  lname: ["family"],
  family: ["family"],
  familyname: ["family"],
  surname: ["family"],
  myoji: ["family"],
  myouji: ["family"],

  mei: ["given"],
  first: ["given", "part1"],
  firstname: ["given"],
  fname: ["given"],
  given: ["given"],
  givenname: ["given"],

  name: ["fullname"],
  fullname: ["fullname"],
  shimei: ["fullname"],
  simei: ["fullname"],
  onamae: ["fullname"],
  namae: ["fullname"],

  company: ["company"],
  corp: ["company"],
  corporate: ["company"],
  corporation: ["company"],
  organization: ["company"],
  org: ["company"],
  kaisha: ["company"],
  kigyo: ["company"],
  kigyou: ["company"],
  hojin: ["company"],
  houjin: ["company"],

  confirm: ["confirm"],
  confirmation: ["confirm"],
  conf: ["confirm"],
  check: ["confirm"],
  re: ["confirm"],
  retype: ["confirm"],
  verify: ["confirm"],
  again: ["confirm"],

  address: ["address"],
  addr: ["address"],
  addressline: ["address"],
  jusho: ["address"],
  juusho: ["address"],

  zip: ["postal"],
  zipcode: ["postal"],
  postcode: ["postal"],
  postal: ["postal"],
  postalcode: ["postal"],
  yubin: ["postal"],
  yuubin: ["postal"],

  pref: ["pref"],
  prefecture: ["pref"],
  todofuken: ["pref"],
  todouhuken: ["pref"],
  todoufuken: ["pref"],
  ken: ["pref"],
  state: ["pref"],
  region: ["pref"],
  province: ["pref"],
  level1: ["pref"],

  city: ["city"],
  shikuchoson: ["city"],
  shiku: ["city"],
  municipality: ["city"],
  level2: ["city"],

  town: ["town"],
  street: ["town"],
  line1: ["town"],
  banchi: ["town"],
  chome: ["town"],

  building: ["building"],
  bldg: ["building"],
  tatemono: ["building"],
  line2: ["building"],
  line3: ["building"],
  room: ["room"],
  unit: ["room"],
  country: ["country"],
  kuni: ["country"],
  mansion: ["building"],
  apartment: ["building"],

  tel: ["tel"],
  phone: ["tel"],
  telephone: ["tel"],
  telno: ["tel"],
  denwa: ["tel"],
  mobile: ["tel", "mobile"],
  cellphone: ["tel", "mobile"],
  cell: ["tel", "mobile"],
  keitai: ["tel", "mobile"],
  smartphone: ["tel", "mobile"],

  fax: ["fax"],
  facsimile: ["fax"],

  email: ["email"],
  mail: ["email"],
  mailaddress: ["email"],
  emailaddress: ["email"],

  password: ["password"],
  passwd: ["password"],
  pass: ["password"],
  pw: ["password"],
  pwd: ["password"],
  passphrase: ["password"],

  username: ["username"],
  userid: ["username"],
  login: ["username"],
  loginid: ["username"],
  account: ["username"],
  accountid: ["username"],
  nickname: ["username"],
  nick: ["username"],
  handle: ["username"],

  birth: ["birth"],
  birthday: ["birth"],
  birthdate: ["birth"],
  dob: ["birth"],
  bday: ["birth"],
  seinengappi: ["birth"],

  year: ["year"],
  yyyy: ["year"],
  yy: ["year"],
  y: ["year"],
  nen: ["year"],
  month: ["month"],
  mm: ["month"],
  m: ["month"],
  tsuki: ["month"],
  day: ["day"],
  dd: ["day"],
  d: ["day"],
  nichi: ["day"],

  era: ["era"],
  gengo: ["era"],
  gengou: ["era"],
  wareki: ["era"],
  nengo: ["era"],
  nengou: ["era"],

  age: ["age"],
  nenrei: ["age"],

  gender: ["gender"],
  sex: ["gender"],
  seibetsu: ["gender"],

  department: ["department"],
  dept: ["department"],
  busho: ["department"],
  division: ["department"],
  section: ["department"],

  title: ["title"],
  position: ["title"],
  yakushoku: ["title"],
  role: ["title"],
  jobtitle: ["title"],

  url: ["url"],
  website: ["url"],
  homepage: ["url"],
  hp: ["url"],
  site: ["url"],

  message: ["message"],
  comment: ["message"],
  comments: ["message"],
  inquiry: ["message"],
  naiyo: ["message"],
  naiyou: ["message"],
  body: ["message"],
  remarks: ["message"],
  remark: ["message"],
  bikou: ["message"],
  biko: ["message"],
  note: ["message"],
  notes: ["message"],
  memo: ["message"],
  question: ["message"],
  content: ["message"],
  contents: ["message"],

  subject: ["subject"],
  kenmei: ["subject"],

  agree: ["agree"],
  // Contact Form 7 の同意欄（`[acceptance]`）。文言に「同意」が無いことがある。
  acceptance: ["agree"],
  agreement: ["agree"],
  consent: ["agree"],
  terms: ["agree"],
  kiyaku: ["agree"],
  privacy: ["agree"],
  policy: ["agree"],
  accept: ["agree"],

  csrf: ["skip"],
  token: ["skip"],
  authenticity: ["skip"],
  captcha: ["skip"],
  recaptcha: ["skip"],
  honeypot: ["skip"],
  nonce: ["skip"],
  search: ["skip"],

  a: ["part1"],
  b: ["part2"],
  c: ["part3"],
  one: ["part1"],
  two: ["part2"],
  three: ["part3"],
  upper: ["part1"],
  lower: ["part2"],
  second: ["part2"],
  area: ["part1"],
  local: ["part2"],
};

/**
 * 2 語で決まる特徴。1 語ずつ見ると別の意味になるもの。
 *
 * `user_name` は空にしてある。Rails の `user[name]` も同じ 2 語に分かれるので、
 * ログイン ID（§2.5 の表にある読み）と氏名を語だけでは分けられない。語からは
 * 何も言わず、label（ユーザー名 か 氏名 か）に決めさせる。ログイン ID は
 * `username` `login_id` のような語に任せる。
 */
const PHRASES: Record<string, Feature[]> = {
  user_name: [],
  user_id: ["username"],
  login_id: ["username"],
  account_id: ["username"],
  account_name: ["username"],
  screen_name: ["username"],
  display_name: ["username"],
  contact_number: ["tel"],
  phone_number: ["tel"],
  tel_number: ["tel"],
  e_mail: ["email"],
  mail_address: ["email"],
  street_address: ["address"],
  address_detail: ["town"],
  date_of_birth: ["birth"],
  job_title: ["title"],
  web_site: ["url"],
  home_page: ["url"],
  site_url: ["url"],
  postal_code: ["postal"],
  zip_code: ["postal"],
  post_code: ["postal"],
};

/**
 * 語の列から特徴を拾う。
 *
 * 2 語の組を先に見て、当たった 2 語は 1 語の表では見ない。`phone_number` の
 * `number` が単独で意味を持つことは無いが、`tel_area` と並ぶ `tel_number` を
 * 3 番目と誤読しないよう、組で消しておく。
 *
 * @param words 小文字の語
 * @returns 見つかった特徴
 */
export function featuresOfWords(words: readonly string[]): Set<Feature> {
  const out = new Set<Feature>();
  const used = new Set<number>();
  for (let i = 0; i + 1 < words.length; i++) {
    const hit = PHRASES[`${words[i]}_${words[i + 1]}`];
    if (hit) {
      for (const f of hit) {
        out.add(f);
      }
      used.add(i);
      used.add(i + 1);
    }
  }
  for (let i = 0; i < words.length; i++) {
    if (used.has(i)) {
      continue;
    }
    const hit = WORDS[words[i]];
    if (hit) {
      for (const f of hit) {
        out.add(f);
      }
    }
  }
  return out;
}

// ---------- label / placeholder ----------

/**
 * 日本語の語と特徴。長いものから順に当て、当たった部分は文字列から消す。
 *
 * 消すのは「姓名」の中の「姓」や「ひらがな」の中の「かな」を二重に読まないため。
 * 長い順に並べ直すので、ここでの順序に意味は無い。
 */
const JA_PHRASES: [string, Feature[]][] = [
  ["せいめい", ["kana", "fullname"]],
  ["セイメイ", ["kana", "fullname"]],
  ["ふりがな", ["kana", "hiragana"]],
  ["フリガナ", ["kana", "katakana"]],
  ["よみがな", ["kana", "hiragana"]],
  ["ヨミガナ", ["kana", "katakana"]],
  ["ひらがな", ["kana", "hiragana"]],
  ["カタカナ", ["kana", "katakana"]],
  ["読み", ["kana"]],
  ["よみ", ["kana"]],
  ["ヨミ", ["kana"]],
  ["カナ", ["kana", "katakana"]],
  ["かな", ["kana", "hiragana"]],

  ["氏名", ["fullname"]],
  ["姓名", ["fullname"]],
  ["お名前", ["fullname"]],
  ["名前", ["fullname"]],
  ["苗字", ["family"]],
  ["名字", ["family"]],
  ["姓", ["family"]],
  ["セイ", ["kana", "katakana", "family"]],
  ["せい", ["kana", "hiragana", "family"]],
  ["メイ", ["kana", "katakana", "given"]],
  ["めい", ["kana", "hiragana", "given"]],

  ["会社", ["company"]],
  ["企業", ["company"]],
  ["法人", ["company"]],
  ["団体", ["company"]],
  ["貴社", ["company"]],
  ["御社", ["company"]],
  ["勤務先", ["company"]],
  ["社名", ["company"]],
  ["屋号", ["company"]],
  ["部署", ["department"]],
  ["所属", ["department"]],
  ["部門", ["department"]],
  ["役職", ["title"]],
  ["肩書", ["title"]],
  ["職位", ["title"]],

  ["郵便番号", ["postal"]],
  ["郵便", ["postal"]],
  ["〒", ["postal"]],
  ["都道府県", ["pref"]],
  ["市区町村", ["city"]],
  ["市区郡", ["city"]],
  ["市町村", ["city"]],
  ["市区", ["city"]],
  ["町名", ["town"]],
  ["番地", ["town"]],
  ["丁目", ["town"]],
  ["町域", ["town"]],
  ["それ以降", ["town"]],
  ["以降の住所", ["town"]],
  ["建物", ["building"]],
  ["マンション", ["building"]],
  ["アパート", ["building"]],
  ["部屋番号", ["room"]],
  ["部屋", ["room"]],
  ["号室", ["room"]],
  ["国/地域", ["country"]],
  ["国・地域", ["country"]],
  ["国名", ["country"]],
  ["ビル", ["building"]],
  ["住所1", ["address", "part1"]],
  ["住所2", ["address", "part2"]],
  ["住所3", ["address", "part3"]],
  ["住所", ["address"]],
  ["所在地", ["address"]],

  ["市外局番", ["tel", "part1"]],
  ["市内局番", ["tel", "part2"]],
  ["加入者番号", ["tel", "part3"]],
  ["携帯", ["tel", "mobile"]],
  ["スマートフォン", ["tel", "mobile"]],
  ["スマホ", ["tel", "mobile"]],
  ["固定電話", ["tel", "home"]],
  ["自宅電話", ["tel", "home"]],
  ["電話", ["tel"]],
  ["tel", ["tel"]],
  ["連絡先", ["tel"]],
  ["ファックス", ["fax"]],
  ["ファクス", ["fax"]],
  ["fax", ["fax"]],

  ["メールアドレス", ["email"]],
  ["eメール", ["email"]],
  ["e-mail", ["email"]],
  ["email", ["email"]],
  ["mail", ["email"]],
  ["メール", ["email"]],
  ["確認", ["confirm"]],
  ["再入力", ["confirm"]],
  ["もう一度", ["confirm"]],
  ["再度", ["confirm"]],
  ["パスワード", ["password"]],
  ["暗証番号", ["password"]],
  ["ユーザー名", ["username"]],
  ["ユーザ名", ["username"]],
  ["ユーザーid", ["username"]],
  ["ユーザid", ["username"]],
  ["ログインid", ["username"]],
  ["会員id", ["username"]],
  ["ニックネーム", ["username"]],
  ["アカウント", ["username"]],
  ["ハンドル", ["username"]],

  ["生年月日", ["birth"]],
  ["誕生日", ["birth"]],
  ["生まれ", ["birth"]],
  ["元号", ["era"]],
  ["和暦", ["era"]],
  ["年号", ["era"]],
  ["年齢", ["age"]],
  ["性別", ["gender"]],

  ["ホームページ", ["url"]],
  ["ウェブサイト", ["url"]],
  ["webサイト", ["url"]],
  ["サイト", ["url"]],
  ["url", ["url"]],

  ["お問い合わせ内容", ["message"]],
  ["お問合せ内容", ["message"]],
  ["お問い合わせ", ["message"]],
  ["お問合せ", ["message"]],
  ["ご要望", ["message"]],
  ["ご質問", ["message"]],
  ["ご意見", ["message"]],
  ["ご相談", ["message"]],
  ["自由記述", ["message"]],
  ["メッセージ", ["message"]],
  ["コメント", ["message"]],
  ["備考", ["message"]],
  ["内容", ["message"]],
  ["本文", ["message"]],
  ["件名", ["subject"]],
  ["タイトル", ["subject"]],
  ["題名", ["subject"]],

  ["同意", ["agree"]],
  ["規約", ["agree"]],
  ["承諾", ["agree"]],
  ["プライバシーポリシー", ["agree"]],
  ["個人情報", ["agree"]],

  ["全角", ["zenkaku"]],
  ["半角", ["hankaku"]],

  ["前3桁", ["part1"]],
  ["上3桁", ["part1"]],
  ["前半", ["part1"]],
  ["後4桁", ["part2"]],
  ["下4桁", ["part2"]],
  ["後半", ["part2"]],
];

/** 長い語から当てるための並び。 */
const JA_ORDERED = [...JA_PHRASES].sort((x, y) => y[0].length - x[0].length);

/**
 * label の文字列を照合用に整える。
 *
 * 全角英数字を半角に、空白を除き、必須マークを落とす。「氏名 ※必須」と
 * 「氏名」を同じものとして扱うため。英字は小文字にする（TEL / FAX / URL / ID）。
 *
 * @param text label や placeholder の文字列
 * @returns 照合用の文字列
 */
export function normalizeLabel(text: string): string {
  return (
    text
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/必須|任意|[※*]/g, "")
      .replace(/\(\)|\[\]|【】|「」/g, "")
      // 全体を括っている括弧。「（姓）」「（名）」は姓・名そのもの。
      // 「郵便番号(前3桁)」のように後ろだけ括弧なら触らない。
      .replace(/^[([【「]([^()[\]【】「」]*)[)\]】」]$/, "$1")
      .replace(/^[:]+|[:]+$/g, "")
  );
}

/**
 * 1 文字の語を探すとき、あっても無視してよい添え書き。
 *
 * 「名（フリガナ）」「年（西暦）」の括弧の中身。これを除いた残りが 1 文字なら、
 * その 1 文字が欄の正体。「会社名」の「名」を拾わないよう、除くのはここに
 * 挙げたものだけにしてある。
 */
const ASIDE =
  /\((西暦|和暦|漢字|かな|カナ|ふりがな|フリガナ|ひらがな|カタカナ|よみ|読み)\)|^西暦|(ふりがな|フリガナ|かな|カナ|ひらがな|カタカナ|よみ|読み)$/g;

/**
 * 日本語の文字列から特徴を拾う。
 *
 * 「名」「年」「月」「日」は 1 文字なので部分一致では使えない。「氏名」「会社名」
 * 「年齢」に必ず含まれるため、文字列全体（添え書きを除く）がそれだけのときに限って認める。
 *
 * @param text label や placeholder の文字列。整形はここで行う
 * @returns 見つかった特徴
 */
export function featuresOfLabel(text: string): Set<Feature> {
  const out = new Set<Feature>();
  const whole = normalizeLabel(text);
  if (whole === "") {
    return out;
  }

  const core = whole.replace(ASIDE, "");
  if (core === "名") {
    out.add("given");
  }
  // 役所のフォームは「姓」ではなく「氏」を使う（「氏」「氏フリガナ」）。
  if (core === "氏") {
    out.add("family");
  }
  if (core === "国") {
    out.add("country");
  }
  if (core === "年") {
    out.add("year");
  }
  if (core === "月") {
    out.add("month");
  }
  if (core === "日") {
    out.add("day");
  }

  let rest = whole;
  for (const [phrase, features] of JA_ORDERED) {
    if (!rest.includes(phrase)) {
      continue;
    }
    for (const f of features) {
      out.add(f);
    }
    rest = rest.split(phrase).join(" ");
  }
  return out;
}

// ---------- options ----------

/** 都道府県の名前。select の選択肢がこれで埋まっていれば、name が何であれ都道府県。 */
const PREF_NAMES = new Set([
  "北海道",
  "青森県",
  "岩手県",
  "宮城県",
  "秋田県",
  "山形県",
  "福島県",
  "茨城県",
  "栃木県",
  "群馬県",
  "埼玉県",
  "千葉県",
  "東京都",
  "神奈川県",
  "新潟県",
  "富山県",
  "石川県",
  "福井県",
  "山梨県",
  "長野県",
  "岐阜県",
  "静岡県",
  "愛知県",
  "三重県",
  "滋賀県",
  "京都府",
  "大阪府",
  "兵庫県",
  "奈良県",
  "和歌山県",
  "鳥取県",
  "島根県",
  "岡山県",
  "広島県",
  "山口県",
  "徳島県",
  "香川県",
  "愛媛県",
  "高知県",
  "福岡県",
  "佐賀県",
  "長崎県",
  "熊本県",
  "大分県",
  "宮崎県",
  "鹿児島県",
  "沖縄県",
]);

const ERA_NAMES = new Set(["明治", "大正", "昭和", "平成", "令和"]);

const GENDER_TEXT = /^(男性?|女性?|male|female|man|woman|おとこ|おんな|メンズ|レディース)$/i;

/**
 * 選択肢の並びから読み取れる特徴。
 *
 * name も label も当てにならないフォーム（`item_3` に「選択してください」）でも、
 * 47 都道府県や 3 つの元号が並んでいれば何の欄かは明らか。年・月・日も、
 * 数字の範囲で分かる。
 *
 * @param options select の選択肢、または radio グループのボタン
 * @returns 見つかった特徴
 */
export function featuresOfOptions(options: readonly FieldOption[]): Set<Feature> {
  const out = new Set<Feature>();
  if (options.length === 0) {
    return out;
  }
  const texts = options.map((o) => o.text.trim());

  if (texts.filter((t) => PREF_NAMES.has(t)).length >= 5) {
    out.add("pref");
  }
  if (texts.filter((t) => ERA_NAMES.has(t)).length >= 2) {
    out.add("era");
  }
  if (texts.filter((t) => GENDER_TEXT.test(t)).length >= 2) {
    out.add("gender");
  }

  // 「選択してください」のような 1 行目を除いて、残り全部が数字のとき。
  const numbers = texts
    .filter((t) => /^\d+(年|月|日)?$/.test(t))
    .map((t) => Number.parseInt(t, 10));
  if (numbers.length >= 3 && numbers.length >= texts.length - 1) {
    const lo = Math.min(...numbers);
    const hi = Math.max(...numbers);
    if (lo >= 1900 && hi <= 2100 && numbers.length >= 20) {
      out.add("year");
    } else if (lo === 1 && hi === 12) {
      out.add("month");
    } else if (lo === 1 && hi >= 28 && hi <= 31) {
      out.add("day");
    }
  }
  return out;
}

// ---------- autocomplete / type ----------

/**
 * autocomplete の標準値と欄種。§1 で最上位のシグナル。
 *
 * `name` `family-name` `given-name` はカナ欄にも付く（Chrome がそう扱う）ので、
 * ここでは氏名にしておいて、あとからカナの語があればカナ側へ寄せる。
 */
const AUTOCOMPLETE: Record<string, FieldKind> = {
  name: "name_full",
  "family-name": "name_family",
  "given-name": "name_given",
  "postal-code": "postal",
  "address-level1": "prefecture",
  "address-level2": "city",
  "address-line1": "town",
  "address-line2": "building",
  "address-line3": "building",
  "street-address": "address_full",
  tel: "tel",
  "tel-national": "tel",
  "tel-area-code": "tel_1",
  "tel-local": "tel_23",
  "tel-local-prefix": "tel_2",
  "tel-local-suffix": "tel_3",
  email: "email",
  "new-password": "password",
  "current-password": "password",
  username: "username",
  nickname: "username",
  bday: "birth",
  "bday-year": "birth_y",
  "bday-month": "birth_m",
  "bday-day": "birth_d",
  sex: "gender",
  organization: "company",
  "organization-title": "job_title",
  url: "url",
};

/**
 * autocomplete 属性から欄種を引く。
 *
 * `section-*` や `shipping` などの修飾は捨てて、最後の語だけを見る。
 * `off` `on` は何も言っていないので `null`。
 *
 * @param value 属性の値
 * @returns 標準値なら欄種。それ以外は `null`
 */
function kindOfAutocomplete(field: FieldInfo): FieldKind | null {
  const words = field.autocomplete.trim().toLowerCase().split(/\s+/);
  const last = words[words.length - 1];
  if (!last) {
    return null;
  }
  // `new-password` は「ブラウザの自動入力を止める」ための細工として、会社名のような
  // text 欄にも付けられる（Marketo のフォームで実際にあった）。type が password の
  // ときだけ信じる。信じるとパスワードを会社名に書くことになる。
  if ((last === "new-password" || last === "current-password") && field.type !== "password") {
    return null;
  }
  return AUTOCOMPLETE[last] ?? null;
}

/** 触らない input の type（§2.9）。search はページ内検索の箱で、フォームの欄ではない。 */
const SKIP_TYPES = new Set([
  "hidden",
  "submit",
  "button",
  "reset",
  "image",
  "file",
  "range",
  "color",
  "search",
]);

// ---------- 判定 ----------

/**
 * 分割番号。`zip1` の 1 が最優先で、無ければ `zip_upper` のような語から取る。
 *
 * 末尾の数字は、name の語が何かを言っているときだけ分割番号とみなす。
 * `field1` `item_3` `q2` の数字は何番目の欄かを表しているだけで、label が
 * 「郵便番号」だからといって前 3 桁ではない。語の無い name の数字は捨て、
 * 同じ欄種が並んでいれば分割とみなす仕事は `group.ts` に任せる。
 *
 * @param tokens name / id の語
 * @param fromTokens name / id の語だけから拾った特徴
 * @param f 全シグナルから拾った特徴
 * @returns 1 始まりの番号。分からなければ `null`
 */
function partOf(tokens: Tokens, fromTokens: Features, f: Features): number | null {
  if (tokens.idx !== null && fromTokens.size > 0) {
    return tokens.idx;
  }
  if (f.has("part1")) {
    return 1;
  }
  if (f.has("part2")) {
    return 2;
  }
  if (f.has("part3")) {
    return 3;
  }
  return null;
}

/**
 * 特徴の集合から欄種を決める。§1 の「同じ欄が複数の欄種に当たったときの優先」。
 *
 * 上から順に見る。カナが最初なのは氏名系より優先するため、会社が氏名の前なのは
 * 「会社系トークンが同居していれば会社名系」のため。電話やメールより下にあるのは、
 * `company_tel` を会社名にしないため。
 *
 * @param f 見つかった特徴
 * @param part 分割番号
 * @param field 判定中の欄。checkbox かどうかを見る
 * @returns 欄種。特徴だけでは決まらなければ `null`
 */
function decide(f: Features, part: number | null, field: FieldInfo): FieldKind | null {
  if (f.has("skip")) {
    return "skip";
  }

  if (f.has("kana")) {
    if (f.has("pref")) {
      return "prefecture_kana";
    }
    if (f.has("city")) {
      return "city_kana";
    }
    if (f.has("town")) {
      return "town_kana";
    }
    if (f.has("address")) {
      // `address1_kana` は町名・番地の読み。建物の読みは持っていないので 2 以降は触らない。
      if (part === 1) {
        return "town_kana";
      }
      return part === null ? "address_kana" : "skip";
    }
    if (f.has("company")) {
      return "company_kana";
    }
    // 語を番号より先に見る。`first` は「名」と「1 番目」の両方を意味するので、
    // 番号から見ると `kana_first` が姓になる。
    if (f.has("family")) {
      return "kana_family";
    }
    if (f.has("given")) {
      return "kana_given";
    }
    if (part === 1) {
      return "kana_family";
    }
    if (part === 2) {
      return "kana_given";
    }
    return "kana_full";
  }

  if (f.has("fax")) {
    return "fax";
  }
  if (f.has("postal")) {
    // zip3 / zip4 は桁数で名付ける流儀。
    if (part === 1 || part === 3) {
      return "postal_1";
    }
    if (part === 2 || part === 4) {
      return "postal_2";
    }
    return "postal";
  }
  if (f.has("email")) {
    return f.has("confirm") || part === 2 ? "email_confirm" : "email";
  }
  if (f.has("tel")) {
    if (part === 1) {
      return "tel_1";
    }
    if (part === 2) {
      return "tel_2";
    }
    if (part === 3) {
      return "tel_3";
    }
    return "tel";
  }
  if (f.has("password")) {
    return f.has("confirm") || part === 2 ? "password_confirm" : "password";
  }
  if (f.has("username")) {
    return "username";
  }
  if (f.has("url")) {
    return "url";
  }
  // 住所より先。`address-ui-widgets-countryCode` は住所の語も持っている。
  if (f.has("country")) {
    return "country";
  }

  if (f.has("pref")) {
    return "prefecture";
  }
  if (f.has("city")) {
    return "city";
  }
  if (f.has("town")) {
    return "town";
  }
  if (f.has("building")) {
    return "building";
  }
  // 建物のあと。「マンション・部屋番号」は 1 つの欄に建物ごと入れる。
  if (f.has("room")) {
    return "room";
  }
  if (f.has("address")) {
    if (part === 1) {
      return "town";
    }
    if (part === 2 || part === 3) {
      return "building";
    }
    return "address_full";
  }

  if (f.has("birth")) {
    if (f.has("year") || part === 1) {
      return "birth_y";
    }
    if (f.has("month") || part === 2) {
      return "birth_m";
    }
    if (f.has("day") || part === 3) {
      return "birth_d";
    }
    if (f.has("era")) {
      return "era";
    }
    return "birth";
  }
  if (f.has("era")) {
    // 「年（和暦）」は元号の select ではなく、和暦で書く年の欄。
    return f.has("year") ? "birth_y" : "era";
  }
  if (f.has("age")) {
    return "age";
  }
  if (f.has("gender")) {
    return "gender";
  }

  if (f.has("department")) {
    return "department";
  }
  if (f.has("title")) {
    return "job_title";
  }
  if (f.has("company")) {
    return "company";
  }
  if (f.has("message")) {
    return "message";
  }
  if (f.has("subject")) {
    return "text";
  }
  // 同意は checkbox だけ。text の label に「規約」とあっても、それは説明文の一部。
  if (f.has("agree") && field.type === "checkbox") {
    return "agree";
  }

  if (f.has("family")) {
    return "name_family";
  }
  if (f.has("given")) {
    return "name_given";
  }
  if (f.has("fullname")) {
    if (part === 1) {
      return "name_family";
    }
    if (part === 2) {
      return "name_given";
    }
    return "name_full";
  }
  return null;
}

/**
 * 上位のシグナルが出した欄種に、カナと確認を被せる。
 *
 * @param kind 上位のシグナルが決めた欄種
 * @param f 全シグナルから拾った特徴
 * @param part 分割番号
 * @returns 被せたあとの欄種
 */
function overlay(kind: FieldKind, f: Features, part: number | null): FieldKind {
  if (f.has("kana")) {
    switch (kind) {
      case "name_full":
        return "kana_full";
      case "name_family":
        return "kana_family";
      case "name_given":
        return "kana_given";
      case "company":
        return "company_kana";
      case "address_full":
        return "address_kana";
      case "prefecture":
        return "prefecture_kana";
      case "city":
        return "city_kana";
      case "town":
        return "town_kana";
      default:
        break;
    }
  }
  if (f.has("confirm") || part === 2) {
    if (kind === "email") {
      return "email_confirm";
    }
    if (kind === "password") {
      return "password_confirm";
    }
  }
  return kind;
}

/**
 * 1 つの欄について集めた材料。form 全体を見る判定（{@link classify}）が使う。
 */
export type Analysis = {
  tokens: Tokens;
  /** name / id / label / placeholder / options の全部から拾った特徴。 */
  features: Set<Feature>;
  /** form 全体を見ずに決めた欄種。 */
  kind: FieldKind;
  /**
   * `year` `month` `day` を単独で持つ欄。3 つ揃えば生年月日として扱う（§2.6）。
   * 単独では何にもならないので、{@link classify} が揃いを見て決める。
   */
  bare: "year" | "month" | "day" | null;
};

/**
 * 1 つの欄を、form の他の欄を見ずに判定する。
 *
 * シグナルは §1 の順。autocomplete → 選択肢 → type → name/id → label → placeholder/aria-label。
 * 上位が欄種を出した時点で下位は見ないが、カナと確認だけは全シグナルの特徴から被せる。
 *
 * 選択肢を type より先に見ているのは、47 都道府県や 3 つの元号が並んだ select は
 * name が `item_3` でも何の欄か明らかだから。§1 の表には無いが、表の趣旨
 * （確度の高いものから）には沿っている。
 *
 * @param field 判定する欄
 * @returns 材料と欄種
 */
export function analyze(field: FieldInfo): Analysis {
  // name と id は別々に分ける。繋げてから分けると、id の末尾の数字だけが
  // 分割番号になり、`name="zip1" id="field"` の 1 が消える。
  const byName = tokenize(field.name);
  const byId = tokenize(field.id);
  const tokens: Tokens = {
    words: [...byName.words, ...byId.words],
    idx: byName.idx ?? byId.idx,
  };
  const fromTokens = featuresOfWords(tokens.words);
  // name が日本語のフォーム（`name="お名前"`）は、name を label と同じ表で読む。
  if (/[^\x20-\x7e]/.test(`${field.name}${field.id}`)) {
    for (const f of featuresOfLabel(`${field.name} ${field.id}`)) {
      fromTokens.add(f);
    }
  }
  const fromLabel = featuresOfLabel(field.label);
  const fromHint = featuresOfLabel(`${field.placeholder} ${field.ariaLabel}`);
  const fromText = new Set<Feature>([...fromLabel, ...fromHint]);
  const fromOptions = featuresOfOptions(field.options);
  const all = new Set<Feature>([...fromTokens, ...fromText, ...fromOptions]);
  const part = partOf(tokens, fromTokens, all);

  const bare = bareOf(all);
  const done = (kind: FieldKind): Analysis => ({
    tokens,
    features: all,
    kind: forControl(refine(kind, fromText, field), field),
    bare,
  });

  if (!field.visible || (field.tag === "input" && SKIP_TYPES.has(field.type))) {
    return done("skip");
  }
  if (all.has("skip") || isNavigation(field)) {
    return done("skip");
  }

  const byAutocomplete = kindOfAutocomplete(field);
  if (byAutocomplete) {
    return done(overlay(byAutocomplete, all, part));
  }

  const byOptions = decide(fromOptions, null, field);
  if (byOptions) {
    return done(byOptions);
  }

  const byType = kindOfType(field, all, part);
  if (byType) {
    return done(byType);
  }

  for (const f of [fromTokens, fromLabel, fromHint]) {
    const kind = decide(f, part, field);
    if (kind) {
      return done(overlay(kind, all, part));
    }
  }

  return done(fallback(field));
}

/**
 * label / placeholder が名指しで言っている区分を、上位のシグナルの結果に被せる。
 *
 * 上位のシグナルは「何の欄か」は言えても「その中のどの部分か」までは言わないことがある。
 *
 * - `your-name` + placeholder「姓」、`kana` + placeholder「セイ」（Contact Form 7 の流儀）。
 *   name は氏名全体としか言っていないが、placeholder は姓だと言っている
 * - EC-CUBE 4 の `addr01` は `autocomplete="address-line1"` だが placeholder は
 *   「市区町村名」、`addr02` は `address-line2` だが「番地・ビル名」。autocomplete の
 *   値は実装者が付け間違えることがあり、placeholder のほうが実際に入れさせたいもの
 *
 * 被せるのは区分の言い換えだけ。欄種そのものは変えない。
 *
 * @param kind 上位のシグナルが決めた欄種
 * @param hint label / placeholder / aria-label から拾った特徴
 * @returns 言い換えたあとの欄種
 */
function refine(kind: FieldKind, hint: Features, field: FieldInfo): FieldKind {
  const family = hint.has("family");
  const given = hint.has("given");
  if (kind === "name_full" && family !== given) {
    return family ? "name_family" : "name_given";
  }
  if (kind === "kana_full" && family !== given) {
    return family ? "kana_family" : "kana_given";
  }

  let k = kind;
  if ((k === "town" || k === "building") && hint.has("city")) {
    if (!hint.has("town") && !hint.has("building")) {
      return "city";
    }
  }
  if (k === "building" && hint.has("town")) {
    k = "town";
  }
  // 「丁目・番地・号」と書かれ、例が「1-2-3」のように数字だけなら、町名は別の欄。
  // Amazon の住所追加がこの形。
  if (
    k === "town" &&
    (isDigitsExample(field.placeholder) || /丁目.{0,3}番地.{0,3}号/.test(field.label))
  ) {
    return "block";
  }
  return k;
}

/**
 * placeholder の例が数字とハイフンだけか。「例：1-2-3」「例:101」。
 *
 * @param placeholder 欄の placeholder
 * @returns 数字だけの例なら `true`
 */
function isDigitsExample(placeholder: string): boolean {
  const s = placeholder
    .normalize("NFKC")
    .replace(/^(例|ex|e\.g\.)[:)\].]?\s*/i, "")
    .trim();
  return s !== "" && /^[\d-]+$/.test(s);
}

/** radio グループとして意味を持つ欄種。選択肢から当てられるもの。 */
const RADIO_KINDS: ReadonlySet<FieldKind> = new Set([
  "gender",
  "era",
  "prefecture",
  "city",
  "birth_y",
  "birth_m",
  "birth_d",
  "age",
  "department",
  "job_title",
  "agree",
  "radio",
  "skip",
]);

/**
 * 語が言っている欄種が、その種類の部品で表せないときは部品の既定に戻す。
 *
 * 「メールアドレスをユーザ ID にする」radio の name が `radio_mail` でも、radio に
 * メールアドレスは入れられない。checkbox は同意かそれ以外かの 2 つしか無い。
 *
 * @param kind 語から決めた欄種
 * @param field 判定中の欄
 * @returns 部品に合わせた欄種
 */
function forControl(kind: FieldKind, field: FieldInfo): FieldKind {
  if (field.type === "radio" && !RADIO_KINDS.has(kind)) {
    return "radio";
  }
  if (field.type === "checkbox" && kind !== "agree" && kind !== "skip") {
    return "checkbox";
  }
  return kind;
}

/**
 * 選ぶとページが移動する select。WordPress のアーカイブや言語切り替えの類。
 *
 * option の value が URL なら、値を入れた瞬間にページが変わる。フォームの欄ではない。
 *
 * @param field 判定する欄
 * @returns 選択肢の大半が URL なら `true`
 */
function isNavigation(field: FieldInfo): boolean {
  if (field.tag !== "select") {
    return false;
  }
  const real = field.options.filter((o) => o.value.trim() !== "");
  if (real.length === 0) {
    return false;
  }
  const urls = real.filter((o) => /^(https?:)?\/\/|^\/[^/]/.test(o.value.trim())).length;
  return urls * 2 >= real.length;
}

/**
 * type から欄種をほぼ確定できるもの（§1 の 2）。
 *
 * `number` は入れていない。`type=number` は年齢にも年にも使われるので、
 * 語で決まらなかったときの {@link fallback} に回す。
 *
 * `checkbox` は語を見てから決める。同意（規約・プライバシー）だけ ON にし、
 * それ以外の checkbox は触らない（§2.8）。
 *
 * @param field 判定する欄
 * @param f 全シグナルから拾った特徴
 * @param part 分割番号
 * @returns 欄種。type が語っていなければ `null`
 */
function kindOfType(field: FieldInfo, f: Features, part: number | null): FieldKind | null {
  if (field.tag !== "input") {
    return null;
  }
  switch (field.type) {
    case "email":
      return overlay("email", f, part);
    case "password":
      return overlay("password", f, part);
    case "url":
      return "url";
    case "date":
      return "birth";
    case "tel": {
      if (f.has("fax")) {
        return "fax";
      }
      const tel = new Set<Feature>(["tel", ...parts(f)]);
      return decide(tel, part, field) ?? "tel";
    }
    case "checkbox":
      return f.has("agree") ? "agree" : "checkbox";
    default:
      return null;
  }
}

/**
 * 特徴のうち分割番号に関わるものだけ。
 *
 * @param f 特徴
 * @returns part1〜part3 のうち含まれているもの
 */
function parts(f: Features): Feature[] {
  return (["part1", "part2", "part3"] as const).filter((p) => f.has(p));
}

/**
 * 何の語も当たらなかった欄の欄種（§2.8）。
 *
 * @param field 判定する欄
 * @returns 要素の種類に応じた既定の欄種
 */
function fallback(field: FieldInfo): FieldKind {
  if (field.tag === "textarea") {
    return "message";
  }
  if (field.tag === "select") {
    return "select";
  }
  if (field.type === "radio") {
    return "radio";
  }
  if (field.type === "number") {
    return "number";
  }
  return "text";
}

/**
 * 単独の年・月・日。生年月日の語と一緒なら単独ではないので `null`。
 *
 * @param f 特徴
 * @returns どれか 1 つだけ含まれていればそれ
 */
function bareOf(f: Features): Analysis["bare"] {
  if (f.has("birth")) {
    return null;
  }
  const hits = (["year", "month", "day"] as const).filter((k) => f.has(k));
  return hits.length === 1 ? hits[0] : null;
}

/**
 * form 全体を見て欄種を決める。
 *
 * 1 欄ずつの判定（{@link analyze}）のあとに、他の欄を見ないと決まらないものを直す。
 *
 * - `name` 単体は、同じ form に姓・名の欄があれば別用途とみなして触らない
 * - 2 つ目の email / password 欄は確認用（語が無いフォームが多い）
 * - `year` `month` `day` 単体は、3 つ揃っていれば生年月日
 *
 * 分割欄の束ね直し（同じ欄種が隣り合う）は `group.ts` の仕事で、ここではやらない。
 *
 * @param fields form の欄。DOM 順
 * @returns 欄ごとの欄種。`fields` と同じ並び
 */
export function classify(fields: readonly FieldInfo[]): FieldKind[] {
  const analyses = fields.map(analyze);
  const kinds = analyses.map((a) => a.kind);

  const hasSplitName = kinds.includes("name_family") && kinds.includes("name_given");
  if (hasSplitName) {
    for (let i = 0; i < kinds.length; i++) {
      const w = analyses[i].tokens.words;
      if (kinds[i] === "name_full" && w.length === 1 && w[0] === "name") {
        kinds[i] = "skip";
      }
    }
  }

  const bare = new Set(analyses.map((a) => a.bare).filter((b) => b !== null));
  if (bare.size === 3) {
    for (let i = 0; i < kinds.length; i++) {
      const b = analyses[i].bare;
      if (b !== null && (kinds[i] === "text" || kinds[i] === "select" || kinds[i] === "number")) {
        kinds[i] = b === "year" ? "birth_y" : b === "month" ? "birth_m" : "birth_d";
      }
    }
  }

  secondIsConfirm(kinds, "email", "email_confirm");
  secondIsConfirm(kinds, "password", "password_confirm");
  return kinds;
}

/**
 * 同じ欄種の 2 つ目を確認用にする。既に確認用の欄があれば何もしない。
 *
 * @param kinds 欄種。書き換える
 * @param kind 元の欄種
 * @param confirm 確認用の欄種
 */
function secondIsConfirm(kinds: FieldKind[], kind: FieldKind, confirm: FieldKind): void {
  if (kinds.includes(confirm)) {
    return;
  }
  let seen = 0;
  for (let i = 0; i < kinds.length; i++) {
    if (kinds[i] !== kind) {
      continue;
    }
    seen += 1;
    if (seen === 2) {
      kinds[i] = confirm;
      return;
    }
  }
}
