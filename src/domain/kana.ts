/**
 * 文字種の変換。ひらがな・カタカナ・半角カナ、全角・半角の数字、ローマ字。
 *
 * 読みはひらがなで持ち（`names.json`、`Person.familyKana`）、欄の文字種規則
 * （`docs/field-rules.md` §5）に合わせてここで変換する。カタカナで持つと
 * ひらがなの欄で戻す必要があり、どちらで持っても変換は要る。ひらがなにしたのは、
 * ローマ字（メールアドレス）へ落とすときの表がひらがな基準で書けるため。
 */

/** ひらがなとカタカナのコードポイントの差。ぁ (U+3041) と ァ (U+30A1)。 */
const KANA_GAP = 0x60;

/** かな・漢字・半角カナのどれか。1 文字でもあれば日本語の文字列とみなす。 */
export const JAPANESE = /[\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f]/;

/**
 * ひらがなをカタカナにする。ひらがな以外はそのまま。
 *
 * @param s 変換する文字列
 * @returns カタカナにした文字列
 */
export function hiraToKata(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + KANA_GAP));
}

/**
 * カタカナをひらがなにする。カタカナ以外はそのまま。
 *
 * 「ヴ」は「ゔ」になる。長音「ー」はひらがなに対応が無いので残す。
 * 住所の読み（`townKana`）には「ー」を含むものがあり、消すと読みが変わる。
 *
 * @param s 変換する文字列
 * @returns ひらがなにした文字列
 */
export function kataToHira(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - KANA_GAP));
}

/**
 * 全角カタカナと半角カナの対応。濁点・半濁点は分解して 2 文字になる。
 *
 * 「ヷ」のような合成文字は入れていない。読みのデータに出てこない。
 */
const HALF_KANA: Record<string, string> = {
  ア: "ｱ",
  イ: "ｲ",
  ウ: "ｳ",
  エ: "ｴ",
  オ: "ｵ",
  カ: "ｶ",
  キ: "ｷ",
  ク: "ｸ",
  ケ: "ｹ",
  コ: "ｺ",
  サ: "ｻ",
  シ: "ｼ",
  ス: "ｽ",
  セ: "ｾ",
  ソ: "ｿ",
  タ: "ﾀ",
  チ: "ﾁ",
  ツ: "ﾂ",
  テ: "ﾃ",
  ト: "ﾄ",
  ナ: "ﾅ",
  ニ: "ﾆ",
  ヌ: "ﾇ",
  ネ: "ﾈ",
  ノ: "ﾉ",
  ハ: "ﾊ",
  ヒ: "ﾋ",
  フ: "ﾌ",
  ヘ: "ﾍ",
  ホ: "ﾎ",
  マ: "ﾏ",
  ミ: "ﾐ",
  ム: "ﾑ",
  メ: "ﾒ",
  モ: "ﾓ",
  ヤ: "ﾔ",
  ユ: "ﾕ",
  ヨ: "ﾖ",
  ラ: "ﾗ",
  リ: "ﾘ",
  ル: "ﾙ",
  レ: "ﾚ",
  ロ: "ﾛ",
  ワ: "ﾜ",
  ヲ: "ｦ",
  ン: "ﾝ",
  ァ: "ｧ",
  ィ: "ｨ",
  ゥ: "ｩ",
  ェ: "ｪ",
  ォ: "ｫ",
  ャ: "ｬ",
  ュ: "ｭ",
  ョ: "ｮ",
  ッ: "ｯ",
  ガ: "ｶﾞ",
  ギ: "ｷﾞ",
  グ: "ｸﾞ",
  ゲ: "ｹﾞ",
  ゴ: "ｺﾞ",
  ザ: "ｻﾞ",
  ジ: "ｼﾞ",
  ズ: "ｽﾞ",
  ゼ: "ｾﾞ",
  ゾ: "ｿﾞ",
  ダ: "ﾀﾞ",
  ヂ: "ﾁﾞ",
  ヅ: "ﾂﾞ",
  デ: "ﾃﾞ",
  ド: "ﾄﾞ",
  バ: "ﾊﾞ",
  ビ: "ﾋﾞ",
  ブ: "ﾌﾞ",
  ベ: "ﾍﾞ",
  ボ: "ﾎﾞ",
  パ: "ﾊﾟ",
  ピ: "ﾋﾟ",
  プ: "ﾌﾟ",
  ペ: "ﾍﾟ",
  ポ: "ﾎﾟ",
  ヴ: "ｳﾞ",
  ー: "ｰ",
  "　": " ",
};

/**
 * 全角カタカナを半角カナにする。ひらがなが混ざっていれば先にカタカナにする。
 *
 * @param s 変換する文字列
 * @returns 半角カナにした文字列。表に無い文字はそのまま
 */
export function toHalfWidthKana(s: string): string {
  return [...hiraToKata(s)].map((c) => HALF_KANA[c] ?? c).join("");
}

/**
 * 半角の数字とハイフンを全角にする。
 *
 * ハイフンは U+FF0D（全角ハイフンマイナス）。日本語 IME で「ー」の隣にある
 * 全角記号がこれで、`normalize("NFKC")` で半角の `-` に戻る。マイナス記号
 * （U+2212）や長音（U+30FC）は NFKC で戻らないので、検証側が全角を半角に
 * 直してから見るフォームで通らない。
 *
 * @param s 変換する文字列
 * @returns 数字とハイフンを全角にした文字列
 */
export function toFullWidthDigits(s: string): string {
  return s.replace(/[0-9-]/g, (c) =>
    c === "-" ? "－" : String.fromCharCode(c.charCodeAt(0) - 0x30 + 0xff10),
  );
}

/**
 * 全角の英数字と記号を半角にする。カナには触らない。
 *
 * `normalize("NFKC")` は半角カナを全角にもしてしまうので使わない。
 *
 * @param s 変換する文字列
 * @returns 英数字と記号を半角にした文字列
 */
export function toHalfWidth(s: string): string {
  return s
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ");
}

/**
 * ひらがなからヘボン式ローマ字への対応。2 文字（拗音）を先に引く。
 *
 * 長音は表記しない（「さとう」→ `satou`）。メールアドレスに使うので、
 * 読みからそのまま復元できる綴りのほうが都合がよい。
 */
const ROMAJI: Record<string, string> = {
  きゃ: "kya",
  きゅ: "kyu",
  きょ: "kyo",
  しゃ: "sha",
  しゅ: "shu",
  しょ: "sho",
  ちゃ: "cha",
  ちゅ: "chu",
  ちょ: "cho",
  にゃ: "nya",
  にゅ: "nyu",
  にょ: "nyo",
  ひゃ: "hya",
  ひゅ: "hyu",
  ひょ: "hyo",
  みゃ: "mya",
  みゅ: "myu",
  みょ: "myo",
  りゃ: "rya",
  りゅ: "ryu",
  りょ: "ryo",
  ぎゃ: "gya",
  ぎゅ: "gyu",
  ぎょ: "gyo",
  じゃ: "ja",
  じゅ: "ju",
  じょ: "jo",
  ぢゃ: "ja",
  ぢゅ: "ju",
  ぢょ: "jo",
  びゃ: "bya",
  びゅ: "byu",
  びょ: "byo",
  ぴゃ: "pya",
  ぴゅ: "pyu",
  ぴょ: "pyo",
  あ: "a",
  い: "i",
  う: "u",
  え: "e",
  お: "o",
  か: "ka",
  き: "ki",
  く: "ku",
  け: "ke",
  こ: "ko",
  さ: "sa",
  し: "shi",
  す: "su",
  せ: "se",
  そ: "so",
  た: "ta",
  ち: "chi",
  つ: "tsu",
  て: "te",
  と: "to",
  な: "na",
  に: "ni",
  ぬ: "nu",
  ね: "ne",
  の: "no",
  は: "ha",
  ひ: "hi",
  ふ: "fu",
  へ: "he",
  ほ: "ho",
  ま: "ma",
  み: "mi",
  む: "mu",
  め: "me",
  も: "mo",
  や: "ya",
  ゆ: "yu",
  よ: "yo",
  ら: "ra",
  り: "ri",
  る: "ru",
  れ: "re",
  ろ: "ro",
  わ: "wa",
  ゐ: "i",
  ゑ: "e",
  を: "o",
  ん: "n",
  が: "ga",
  ぎ: "gi",
  ぐ: "gu",
  げ: "ge",
  ご: "go",
  ざ: "za",
  じ: "ji",
  ず: "zu",
  ぜ: "ze",
  ぞ: "zo",
  だ: "da",
  ぢ: "ji",
  づ: "zu",
  で: "de",
  ど: "do",
  ば: "ba",
  び: "bi",
  ぶ: "bu",
  べ: "be",
  ぼ: "bo",
  ぱ: "pa",
  ぴ: "pi",
  ぷ: "pu",
  ぺ: "pe",
  ぽ: "po",
  ぁ: "a",
  ぃ: "i",
  ぅ: "u",
  ぇ: "e",
  ぉ: "o",
  ゃ: "ya",
  ゅ: "yu",
  ょ: "yo",
  ゔ: "vu",
};

/**
 * ひらがなをローマ字にする。
 *
 * 促音「っ」は次の子音を重ねる（「はっとり」→ `hattori`）。次が `ch` なら `t` を
 * 足す（「まっちゃ」→ `matcha`）。文字列の末尾や母音の前の「っ」は消す。
 * 表に無い文字（カタカナ、漢字、記号）はそのまま残す。
 *
 * @param hiragana ひらがなの読み
 * @returns 小文字のローマ字
 */
export function toRomaji(hiragana: string): string {
  const s = kataToHira(hiragana);
  let out = "";
  let i = 0;
  while (i < s.length) {
    if (s[i] === "っ") {
      const next = romajiAt(s, i + 1);
      if (next && /^[^aeiou]/.test(next.text)) {
        out += next.text.startsWith("ch") ? "t" : next.text[0];
      }
      i++;
      continue;
    }
    const hit = romajiAt(s, i);
    if (hit) {
      out += hit.text;
      i += hit.length;
    } else {
      out += s[i];
      i++;
    }
  }
  return out;
}

/**
 * 位置 `i` から読めるローマ字。2 文字の拗音を先に試す。
 *
 * @param s ひらがなの文字列
 * @param i 読み始める位置
 * @returns ローマ字と消費した文字数。表に無ければ `null`
 */
function romajiAt(s: string, i: number): { text: string; length: number } | null {
  const two = s.slice(i, i + 2);
  if (two.length === 2 && ROMAJI[two] !== undefined) {
    return { text: ROMAJI[two], length: 2 };
  }
  const one = s[i];
  if (one !== undefined && ROMAJI[one] !== undefined) {
    return { text: ROMAJI[one], length: 1 };
  }
  return null;
}
