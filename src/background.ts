import { receiveReport, startFill, startPick, startPlace } from "./application/fill";
import { message } from "./application/i18n";
import type { Report } from "./domain/protocol";

/**
 * Service Worker。起動の入口を 3 つ用意して、あとは application に渡すだけ。
 *
 * - ツールバーのアイコン … このページに入力
 * - 右クリックメニュー … 3 項目（入力・住所を替える・この欄にデータを埋める）
 * - ショートカット … 入力、住所を替える、この欄にデータを埋める
 *
 * ショートカットの既定は Ctrl/Cmd+Shift+Y（入力）、U（住所）、K（欄）。右手の並びに揃えた。
 * spec は D だったが、Ctrl/Cmd+Shift+D は Chrome 自身が「すべてのタブを
 * ブックマーク」に使っており、拡張の割り当ては効かない。F は Fake Filler の既定で、
 * 同じキーは先に入っていた拡張が取り、こちらは黙って未設定になる。Chrome が Ctrl/Cmd+Shift に
 * 割り当てているのは A/B/C/D/G/H/I/J/M/N/O/R/T/V/W と Delete、1Password が X。
 * Y・U・K はどれとも重ならない。合わなければ chrome://extensions/shortcuts で変えられる。
 */

/** 右クリックメニューの id。並び順もこのまま。表題は `_locales` のキー。 */
const MENUS = {
  fill: { id: "jp-dummy-fill-fill", title: "menuFill" },
  place: { id: "jp-dummy-fill-place", title: "menuAddress" },
  pick: { id: "jp-dummy-fill-pick", title: "menuFillOne" },
} as const;

chrome.runtime.onInstalled.addListener(() => {
  // 更新のたびに作り直す。同じ id で create すると重複エラーになるため。
  chrome.contextMenus.removeAll(() => {
    // select や radio は Chrome の「編集可能」に入らないので、editable だけでは出ない。
    // page でも出しておき、欄が分からなければコンテンツスクリプト側が断る。
    for (const m of Object.values(MENUS)) {
      chrome.contextMenus.create({
        id: m.id,
        title: message(m.title),
        contexts: ["page", "editable"],
      });
    }
  });
});

chrome.action.onClicked.addListener((tab) => {
  void startFill(tab);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab) {
    return;
  }
  switch (info.menuItemId) {
    case MENUS.fill.id:
      void startFill(tab);
      return;
    case MENUS.place.id:
      void startPlace(tab);
      return;
    case MENUS.pick.id:
      void startPick(tab, "menu");
      return;
    default:
      return;
  }
});

// パレットで選んだ結果と、番号で呼び戻したときの結果。コンテンツスクリプトから届く。
chrome.runtime.onMessage.addListener((report: Report, sender) => {
  if (report.type === "report" && sender.tab?.id !== undefined) {
    receiveReport(report, sender.tab.id);
  }
});

// manifest の `commands` に書いてある名前。ここと一致しないと起動しない。
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "fill") {
    void withTab(tab, (t) => startFill(t));
  } else if (command === "place") {
    void withTab(tab, (t) => startPlace(t));
  } else if (command === "pick") {
    void withTab(tab, (t) => startPick(t, "key"));
  }
});

/**
 * ショートカットで起動する。
 *
 * 渡されるタブを当てにしきらないのは、この引数が省略可能だから。取れなかった
 * ときに黙って終わると、押しても何も起きないキーになってしまう。url が無い
 * タブは {@link startFill} が「使えないページ」として弾くので、無い場合も引き直す。
 *
 * @param tab onCommand が渡してきたタブ。渡されないことがある
 * @param act タブが決まったら呼ぶ
 * @returns 起動を終えると解決する Promise
 */
async function withTab(
  tab: chrome.tabs.Tab | undefined,
  act: (tab: chrome.tabs.Tab) => Promise<void>,
): Promise<void> {
  if (tab?.url) {
    await act(tab);
    return;
  }
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (active) {
    await act(active);
  }
}
