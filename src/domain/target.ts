/**
 * 入力できないページのスキーム。
 *
 * chrome:// などの特権ページには activeTab でもスクリプトを注入できない。
 * 呼んでも例外になるだけなので、手前で弾いて理由を出す。
 */
const BLOCKED = /^(chrome|edge|brave|about|devtools|view-source|chrome-extension|moz-extension):/i;

/**
 * スキームは普通の https でも、ブラウザ側が注入を禁じているページ。
 *
 * ウェブストアがこれにあたる。手前で弾かないと executeScript が例外になり、
 * 押しても何も起きないページとして扱えなくなる。
 *
 * @param url 判定するページの URL
 * @returns ウェブストアなら `true`。URL として解釈できなければ `false`
 */
function isWebStore(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") {
    return false;
  }
  if (parsed.hostname === "chromewebstore.google.com") {
    return true;
  }
  // 旧ストア。今は新ドメインへ転送されるが、履歴から開けば残っている。
  return parsed.hostname === "chrome.google.com" && parsed.pathname.startsWith("/webstore");
}

/**
 * そのタブに入力を試みてよいか。
 *
 * URL が取れないタブ（読み込み中など）も対象外として扱う。
 *
 * `file:` はここでは通す。拡張の「ファイルの URL へのアクセスを許可」次第で
 * 結果が変わり、URL だけでは判断できないため。実際に失敗したら呼び出し側が伝える。
 *
 * @param url タブの URL。まだ取れていなければ `undefined`
 * @returns 注入を試してよいなら `true`
 */
export function isFillable(url: string | undefined): boolean {
  if (!url) {
    return false;
  }
  if (BLOCKED.test(url)) {
    return false;
  }
  return !isWebStore(url);
}
