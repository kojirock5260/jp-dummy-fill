import { message } from "./application/i18n";
import { ADDRESS_KINDS, type FieldKind } from "./domain/field";
import { ALIASES, isMenuKind, MENU_GROUPS } from "./domain/menu";
import type { Place } from "./domain/person";
import { PLACE_GROUPS } from "./domain/places";
import { guess, homePrefecture, kindsOf, makePlan, planOne, type Variant } from "./domain/plan";
import type { Message, Reply, Report } from "./domain/protocol";
import { seedAt } from "./domain/seed";
import { type Collected, collect } from "./presentation/collect";
import { openPalette } from "./presentation/palette";
import { writeAddress, writeOne, writePlan } from "./presentation/write";

/**
 * ページに注入されるスクリプト。
 *
 * 同じページへ 2 回注入されても購読が二重にならないよう、貼った listener を
 * window に控えておき、次に注入されたときは外してから貼り直す。
 *
 * 真偽値の印で「もう入れた」と判断してはいけない。拡張を読み込み直すと古い
 * listener は死ぬが、window に付けた印はページに残る。印だけを見ると、死んだ
 * 購読を生きていると誤解して登録せずに終わり、以後そのタブでは何も起きなくなる。
 * 更新のたびに開いていたタブが全滅するので、印ではなく実体を持っておく。
 */

const KEY = "__jpDummyFill__";

type Listener = (
  message: Message,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: Reply) => void,
) => boolean;

/** window に控える実体。メッセージの購読と、右クリックの監視。 */
type Hooks = {
  message: Listener;
  contextmenu: (e: MouseEvent) => void;
};

declare global {
  interface Window {
    [KEY]?: Hooks;
  }
}

/**
 * ページ内に持つ状態。spec §2 の「seed はページ内」。
 *
 * seed の初期値は注入された時刻から決まる（{@link seedAt}）。ページを開くたびに別の人。
 * 番号を指定して呼び戻せば、その番号になる。
 *
 * `place` は今の住所。「住所を遠隔地・離島に替える…」で選んだ場所になり、
 * 「元の住所に戻す」で中心に戻る。`home` は離れる前の都道府県。離島が都道府県の
 * select を書き換えたあとで戻るとき、select を読むと離島の県の中心になってしまうので、
 * 離れる前に控えておく。
 */
const state: { seed: number; place: Place; home?: string } = {
  seed: seedAt(new Date()),
  place: { kind: "center" },
};

/** パレットで「元の住所に戻す」を指す印。郵便番号と混ざらない文字列。 */
const HOME = "home";

/**
 * 右クリックされた要素。「この欄にデータを埋める」の対象。
 *
 * Chrome の右クリックメニューは押された要素を拡張に教えない。メニューが開く前の
 * `contextmenu` イベントで覚えておく。初回はまだ注入されていないので取れないが、
 * Chrome は右クリックで入力欄にフォーカスを移すので、`document.activeElement` で補える。
 */
let lastContext: { el: Element; at: number } | null = null;

/** 右クリックを覚えておく時間（ミリ秒）。メニューを眺めている時間として十分。 */
const CONTEXT_TTL_MS = 30_000;

/**
 * 今の人物と住所。
 *
 * @returns 計画に渡す選び方
 */
function variant(): Variant {
  return { seed: state.seed, place: state.place };
}

/**
 * ページの空いている欄を埋める。spec §3 の 1〜7b。
 *
 * @returns 値を書いた欄の数
 */
async function fill(): Promise<number> {
  const collected = collect(document);
  const plan = makePlan(
    collected.map((c) => c.info),
    variant(),
  );
  return writePlan(collected, plan);
}

/**
 * あとから出た結果を Service Worker に送る。バッジに出してもらう。
 *
 * 拡張が読み込み直されて受け手が消えていれば例外になるが、欄には既に書けているので
 * 握り潰してよい。
 *
 * @param report 送る結果
 */
function report(report: Report): void {
  void chrome.runtime.sendMessage(report).catch(() => {});
}

/**
 * 要素が指す入力欄。label の上なら、その label が指す欄。
 *
 * @param el 要素
 * @returns 入力欄。無ければ `null`
 */
function controlOf(el: Element | null): Element | null {
  if (!el) {
    return null;
  }
  if (el.matches("input, select, textarea")) {
    return el;
  }
  return el.closest("label")?.control ?? null;
}

/**
 * 「この欄にデータを埋める」の対象の欄。
 *
 * 右クリックから来たなら、覚えていた要素を先に見る。radio や select は右クリックで
 * フォーカスが移らないことがあるため。ショートカットから来たなら、フォーカスのある欄を
 * 先に見る。右クリックの記憶は古いかもしれない。
 *
 * @param via どちらの入口から来たか
 * @returns 入力欄。分からなければ `null`
 */
function targetField(via: "menu" | "key"): Element | null {
  const recent =
    lastContext && Date.now() - lastContext.at < CONTEXT_TTL_MS ? lastContext.el : null;
  const fromMenu = controlOf(recent);
  const focused = controlOf(document.activeElement);
  return via === "key" ? (focused ?? fromMenu) : (fromMenu ?? focused);
}

/**
 * 集めた欄の中で、その要素の位置。radio はグループの中のどれでもよい。
 *
 * @param collected 集めた欄
 * @param target 探す要素
 * @returns 位置。無ければ -1
 */
function indexOf(collected: readonly Collected[], target: Element): number {
  return collected.findIndex(
    (c) => c.el === target || (c.radios?.includes(target as HTMLInputElement) ?? false),
  );
}

/**
 * 1 つの欄に、人が選んだ欄種の値を上書きで入れる。
 *
 * 選んだ時点で欄を集め直す。パレットを開いている間にページが変わっていても、
 * 今ある欄に対して書く。判定が外した欄の記録を console に出す。規則を育てる材料になる。
 * DevTools の Verbose を出さない限り見えないので、普段の邪魔にはならない。
 *
 * @param target 書く欄
 * @param kind 人が選んだ欄種
 */
function applyKind(target: Element, kind: FieldKind): void {
  const collected = collect(document);
  const at = indexOf(collected, target);
  if (at < 0) {
    return;
  }
  const fields = collected.map((c) => c.info);
  const { value, guessed } = planOne(fields, at, kind, variant());
  const f = fields[at];
  console.debug("[jp-dummy-fill] manual", kind, {
    guessed,
    name: f.name,
    id: f.id,
    label: f.label,
    placeholder: f.placeholder,
    autocomplete: f.autocomplete,
  });
  const filled = value !== null && writeOne(collected[at], value) ? 1 : 0;
  report({ type: "report", filled });
}

/**
 * 番号で人物を呼び戻し、その人でページの空いている欄を埋める。
 *
 * 呼び戻すだけで何も起きないと、効いたのか分からない。空いている欄が埋まれば見える。
 * 既に埋まっているページでは何も変わらないので、その場合はリロードしてから呼ぶ。
 *
 * @param seed 呼び戻す番号
 */
async function recall(seed: number): Promise<void> {
  state.seed = seed;
  state.place = { kind: "center" };
  state.home = undefined;
  const filled = await fill();
  report({ type: "report", filled });
}

/**
 * 欄種を選ぶパレットを、対象の欄のそばに開く。
 *
 * 見出しと欄種の表示名はここで引く。domain の menu.ts は文字列を持たない。
 *
 * @param via どちらの入口から来たか
 * @returns 返事。対象の欄が分からなければ `noTarget`
 */
function pick(via: "menu" | "key"): Reply {
  const target = targetField(via);
  if (!target) {
    return { ok: false, reason: "noTarget" };
  }
  const collected = collect(document);
  const at = indexOf(collected, target);
  if (at < 0) {
    return { ok: false, reason: "noTarget" };
  }

  const guessed = guess(
    collected.map((c) => c.info),
    at,
  );
  openPalette({
    anchor: target,
    groups: MENU_GROUPS.map((g) => ({
      title: message(`group_${g.id}`),
      items: g.kinds.map((kind) => ({
        id: kind,
        label: message(`kind_${kind}`),
        aliases: ALIASES[kind] ?? [],
      })),
    })),
    placeholder: message("palettePlaceholder"),
    guess: isMenuKind(guessed) ? message("paletteGuess", message(`kind_${guessed}`)) : "",
    recall: {
      label: message("paletteRecall"),
      placeholder: message("paletteRecallPlaceholder"),
      aliases: ["ばんごう", "よびだす", "no", "number", "seed"],
      onRecall: (seed) => {
        void recall(seed);
      },
    },
    onPick: (id) => {
      if (isMenuKind(id)) {
        applyKind(target, id);
      }
    },
  });
  return { ok: true, opened: true };
}

/**
 * 住所を選ぶパレットを開く。「住所を遠隔地・離島に替える…」。
 *
 * 並べるのは配送業者が区分している場所（`domain/places.ts`）と「元の住所に戻す」。
 * 選ぶと {@link moveTo} が住所の欄だけを上書きする。
 *
 * パレットは住所の欄のそばに出す。郵便番号や都道府県の欄が無いページなら、
 * フォーカスのある要素のそば。それも無ければ左上。
 *
 * @returns 返事。パレットは必ず開く
 */
function choosePlace(): Reply {
  const collected = collect(document);
  const kinds = kindsOf(collected.map((c) => c.info));
  const at = kinds.findIndex((k) => ADDRESS_KINDS.has(k));
  const anchor = at >= 0 ? collected[at].el : (document.activeElement ?? document.documentElement);

  openPalette({
    anchor,
    groups: [
      {
        title: "",
        items: [{ id: HOME, label: message("placeHome"), aliases: ["もと", "もどす", "home"] }],
      },
      ...PLACE_GROUPS.map((g) => ({
        title: message(g.id === "region" ? "placeGroupRegion" : "placeGroupIsland"),
        items: g.items.map((p) => ({ id: p.zip, label: p.label, aliases: p.aliases })),
      })),
    ],
    placeholder: message("placePlaceholder"),
    guess: "",
    onPick: (id) => {
      moveTo(id);
    },
  });
  return { ok: true, opened: true };
}

/**
 * 住所を選んだ場所に替え、住所の欄を上書きする。人物はそのまま。
 *
 * 埋まったページで使われるのが普通なので、「値がある欄は飛ばす」では何も起きない。
 * 住所に属する欄種だけを新しい住所で書き直す（{@link writeAddress}）。
 *
 * 中心から離れる最初の一歩で、今の都道府県を `home` に控える。「元の住所に戻す」は
 * その県の中心へ戻す。控えないと、離島が select に書いた県の中心に「戻って」しまう。
 *
 * @param id 選んだ場所の郵便番号。{@link HOME} なら元の住所
 */
function moveTo(id: string): void {
  const collected = collect(document);
  const fields = collected.map((c) => c.info);
  let v: Variant;
  if (id === HOME) {
    v = { seed: state.seed, place: { kind: "center" }, pref: state.home };
    state.place = { kind: "center" };
    state.home = undefined;
  } else {
    if (state.place.kind === "center") {
      state.home = homePrefecture(fields, variant());
    }
    state.place = { kind: "at", zip: id };
    v = variant();
  }
  const filled = writeAddress(collected, makePlan(fields, v));
  report({ type: "report", filled });
}

const handle: Listener = (message, _sender, sendResponse) => {
  switch (message.type) {
    case "pick":
      sendResponse(pick(message.via));
      return false;
    case "place":
      sendResponse(choosePlace());
      return false;
    case "fill":
      // 郵便番号のあとに待つので非同期。true を返して応答の口を開けておく。
      void fill().then(
        (filled) => sendResponse({ ok: true, filled }),
        // 失敗しても必ず返す。黙って落ちると、送った側は理由を出せない。
        (e) => {
          console.error("[jp-dummy-fill]", e);
          sendResponse({ ok: false });
        },
      );
      return true;
    default:
      return false;
  }
};

const onContextMenu = (e: MouseEvent): void => {
  if (e.target instanceof Element) {
    lastContext = { el: e.target, at: Date.now() };
  }
};

// 死んだコンテキストのものは外れないが、そもそも購読が消えているので実害はない。
const previous = window[KEY];
if (previous) {
  chrome.runtime.onMessage.removeListener(previous.message);
  document.removeEventListener("contextmenu", previous.contextmenu, true);
}
window[KEY] = { message: handle, contextmenu: onContextMenu };
chrome.runtime.onMessage.addListener(handle);
document.addEventListener("contextmenu", onContextMenu, true);
