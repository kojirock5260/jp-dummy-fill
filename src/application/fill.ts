import type { Message, Reply, Report } from "../domain/protocol";
import { isFillable } from "../domain/target";
import { message } from "./i18n";
import { clearProblem, showCount, showProblem } from "./notify";

/**
 * そのタブに入力させる。
 *
 * activeTab はアイコンのクリック・右クリックメニュー・ショートカットで付与される。
 * どの入口から来ても、この関数を呼ぶ時点では権限が付いている。
 *
 * @param tab 起動元のタブ。id が無ければ何もしない
 * @returns バッジを出し終えると解決する Promise
 */
export async function startFill(tab: chrome.tabs.Tab): Promise<void> {
  await run(tab, { type: "fill" });
}

/**
 * そのタブに、住所を選ぶパレットを開かせる。「住所を遠隔地・離島に替える…」。
 *
 * 選んだあとの書き込みはコンテンツスクリプトが行い、結果は {@link receiveReport} で届く。
 *
 * @param tab 起動元のタブ。id が無ければ何もしない
 * @returns パレットが開くか、理由を出し終えると解決する Promise
 */
export async function startPlace(tab: chrome.tabs.Tab): Promise<void> {
  await run(tab, { type: "place" });
}

/**
 * そのタブの、右クリックされた（またはフォーカスのある）欄のそばに、欄種を選ぶ
 * パレットを開かせる。
 *
 * @param tab 起動元のタブ。id が無ければ何もしない
 * @param via 右クリックメニューからか、ショートカットからか
 * @returns パレットが開くか、理由を出し終えると解決する Promise
 */
export async function startPick(tab: chrome.tabs.Tab, via: "menu" | "key"): Promise<void> {
  await run(tab, { type: "pick", via });
}

/**
 * メッセージをタブに届けて、結果をアイコンに出す。
 *
 * まず注入せずにメッセージを送る。返事があれば前回注入したスクリプトが生きていて、
 * そこにある seed もそのまま使える。返事が無ければ初回なので注入してから送り直す。
 * 毎回注入すると seed と住所の巡りがページ内で初期値に戻り、番号で呼び戻した人物や
 * 「住所を替える」の続きが消える。
 *
 * 失敗しても投げ返さない。黙って終わると押し間違いと区別が付かないので、理由は
 * アイコンに出す。
 *
 * @param tab 起動元のタブ
 * @param request 届けるメッセージ
 * @returns バッジを出し終えると解決する Promise
 */
async function run(tab: chrome.tabs.Tab, request: Message): Promise<void> {
  if (!tab.id) {
    return;
  }
  const tabId = tab.id;
  clearProblem(tabId);

  if (!isFillable(tab.url)) {
    showProblem(tabId, message("errUnsupported"));
    return;
  }

  try {
    let reply = await send(tabId, request);
    if (reply === null) {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
      reply = await send(tabId, request);
    }
    if (!reply?.ok) {
      showProblem(
        tabId,
        reply?.reason === "noTarget" ? message("errNoTarget") : message("errUnsupported"),
      );
      return;
    }
    // パレットを開いただけなら出すものが無い。選んだあとの結果は Report で届く。
    if ("filled" in reply) {
      showCount(tabId, reply.filled);
    }
  } catch (e) {
    console.error("[jp-dummy-fill]", e);
    showProblem(tabId, reasonOf(tab.url));
  }
}

/**
 * コンテンツスクリプトからあとで届いた結果を、アイコンに出す。
 *
 * パレットで欄種や場所を選んだときと、番号で人物を呼び戻したとき。返事の口は閉じているので、
 * コンテンツスクリプトが自分から送ってくる。
 *
 * @param report 届いた結果
 * @param tabId 送ってきたタブ
 */
export function receiveReport(report: Report, tabId: number): void {
  showCount(tabId, report.filled);
}

/**
 * 例外から伝えられることは多くないので、URL から言えるぶんだけ足す。
 *
 * `file:` は「ファイルの URL へのアクセスを許可」を入れないと注入できない。
 * 拡張の詳細画面にある設定なので、そこまで案内しないと直しようがない。
 *
 * @param url 失敗したタブの URL
 * @returns tooltip に出す理由
 */
function reasonOf(url: string | undefined): string {
  if (url?.startsWith("file:")) {
    return message("errFileAccess");
  }
  return message("errUnsupported");
}

/**
 * メッセージを送り、返事を返す。
 *
 * まだ注入されていないタブへ送ると例外になるが、それは異常ではなく
 * 「初回だった」というだけなので、`null` に潰す。
 *
 * @param tabId 送り先のタブ
 * @param request 送るメッセージ
 * @returns 返事。受け手がいなければ `null`
 */
async function send(tabId: number, request: Message): Promise<Reply | null> {
  try {
    const reply: Reply | undefined = await chrome.tabs.sendMessage(tabId, request);
    return reply ?? null;
  } catch {
    return null;
  }
}
