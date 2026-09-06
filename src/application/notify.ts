/**
 * 結果をツールバーアイコンに出す。
 *
 * この拡張にはポップアップもオプションページも無い。ページ側にも何も描かないので、
 * 入れた欄数も失敗の理由も、出す場所はアイコンだけになる。バッジと tooltip なら
 * 権限は増えない。
 */

/** 入れた欄数を出しておく時間（ミリ秒）。目の端で数を確かめる程度なので短い。 */
const COUNT_MS = 2000;

/** 失敗を出しておく時間（ミリ秒）。tooltip を読みに行く時間ぶん長い。 */
const PROBLEM_MS = 5000;

const COUNT_COLOR = "#2563eb";
const PROBLEM_BADGE = "!";
const PROBLEM_COLOR = "#ef4444";
const TITLE = "jp-dummy-fill";

/**
 * バッジと tooltip を元に戻す。前回の表示が残っていると、今回の結果と紛らわしい。
 *
 * @param tabId 対象のタブ
 */
export function clearProblem(tabId: number): void {
  quiet(chrome.action.setBadgeText({ tabId, text: "" }));
  quiet(chrome.action.setTitle({ tabId, title: TITLE }));
}

/**
 * 入れた欄数を出す。
 *
 * バッジは 4 文字が上限なので数だけ。誰が記入したかは出さない。人物の番号は
 * メールアドレスの末尾に見えていて、tooltip に載せても見に行く理由が無い。
 * tooltip は失敗の理由が残っていれば消す。
 *
 * @param tabId 対象のタブ
 * @param count 値を書いた欄の数
 */
export function showCount(tabId: number, count: number): void {
  quiet(chrome.action.setBadgeText({ tabId, text: String(count) }));
  quiet(chrome.action.setBadgeBackgroundColor({ tabId, color: COUNT_COLOR }));
  quiet(chrome.action.setTitle({ tabId, title: TITLE }));
  setTimeout(() => quiet(chrome.action.setBadgeText({ tabId, text: "" })), COUNT_MS);
}

/**
 * 失敗を出す。
 *
 * バッジは目印にしかならないので、理由は tooltip に入れる。
 * Service Worker が先に止まればバッジは残るが、次の起動で {@link clearProblem} が消す。
 *
 * @param tabId 対象のタブ
 * @param reason tooltip に出す理由。ユーザーが次に取れる行動まで書く
 */
export function showProblem(tabId: number, reason: string): void {
  quiet(chrome.action.setBadgeText({ tabId, text: PROBLEM_BADGE }));
  quiet(chrome.action.setBadgeBackgroundColor({ tabId, color: PROBLEM_COLOR }));
  quiet(chrome.action.setTitle({ tabId, title: `${TITLE}: ${reason}` }));
  setTimeout(() => clearProblem(tabId), PROBLEM_MS);
}

/**
 * 拒否を握り潰す。タブが閉じられていれば失敗するが、伝えられないだけで実害は無い。
 *
 * @param p chrome.action の呼び出しが返す Promise
 */
function quiet(p: Promise<unknown>): void {
  void p.catch(() => {});
}
