/**
 * 表示文字列を取り出す。
 *
 * 対訳は `public/_locales/<言語>/messages.json` にあり、ブラウザの表示言語に
 * 合わせて Chrome が選ぶ。合う言語が無ければ manifest の `default_locale`（en）
 * に落ちる。切り替え用の設定を持たないので、`storage` 権限は要らない。
 *
 * Service Worker からもコンテンツスクリプトからも呼べる。`i18n` は権限が不要な
 * 数少ない API のひとつ。
 */

/**
 * 対訳を引く。
 *
 * 見つからなければキーをそのまま返す。空文字を返すと画面から文字が消えるだけで
 * 原因が分からないが、キーが出ていれば足りない対訳がすぐ分かる。
 *
 * @param key `messages.json` のキー
 * @param subs `$KEY$` などの差し込み文字列
 * @returns 表示する文字列
 */
export function message(key: string, ...subs: string[]): string {
  return chrome.i18n.getMessage(key, subs) || key;
}
