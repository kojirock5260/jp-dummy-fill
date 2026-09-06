# 実サイトのフォーム調査（2026-09-05）

判定ルール（`field-rules.md`）が実サイトでどう外れるかを見るために、公開されている
日本語フォームの作りを抜き出して、判定に通した。抜き出したものは
`tests/fixtures/forms/*.json`、判定の期待値は `tests/domain/forms.test.ts` にある。
抜き出しは `scripts/capture-form.js` を DevTools のコンソールに貼って行う。値は取らない。

## 見たフォームと、直したこと

| サイト | 種類 | 作りの特徴 | 直したこと |
|---|---|---|---|
| 楽天会員登録 | 会員登録（`<table>`） | `<th>` に見出し、`<td>` に注意書きと欄。`lname` `fname` `lname_kana`、`email` `email2`、ユーザ ID は `u`、パスワードは `p`。姓・名の前に「（姓）」「（名）」 | 直前テキストが注意書きでも `<th>` を label に足す。全体を括る括弧を外して「姓」「名」と読む |
| EC-CUBE 4 デモ | EC 会員登録 | `entry[name][name01]` の入れ子 name。`autocomplete` が全欄に付くが、`addr01`（市区町村）が `address-line1`、`addr02`（番地・ビル名）が `address-line2` と実態とずれる。placeholder は「例：5300001」「例：11122223333」。ヘッダーに検索窓とカテゴリ select | placeholder が名指しで言う区分（市区町村・番地）を autocomplete の結果に被せる。placeholder の例の数字でハイフン有無を決める。検索フォームの中は触らない |
| LoGoフォーム（自治体） | 電子申請（Vuetify） | `name` が無く `id="input-73"` のみ。label は `for=` で結ばれる。姓は「氏」。都道府県は readonly の input（ドロップダウン）。生年月日は aria-label で「ハイフン区切り」 | 「氏」「氏フリガナ」を姓として読む。label / aria-label の「ハイフン区切り」に従う |
| Google フォーム | 汎用 | `name` も `id` も無く、`aria-labelledby` が設問文を指す。`type` は全部 text。radio / checkbox は `div[role=radio]` | 設問文だけで判定できることを確認（変更なし） |
| SmartHR お問い合わせ | B2B 問い合わせ（Marketo） | Salesforce 流儀の name（`LastName` `Email` `Title_class__c`）。会社名の欄に `autocomplete="new-password"`（自動入力を止める細工）。「お問い合わせ内容」が select | `new-password` は `type=password` のときだけ信じる。自由記述系の欄種が select に当たったら先頭の選択肢。`corporate` を会社の語に足す |
| オレインデザイン | 問い合わせ（Snow Monkey Forms） | label が欄に結び付いておらず、直前テキストも取れない。`name` `mail` `message` だけが手掛かり | 変更なし。name で通る |
| ウェブロード | 問い合わせ（Contact Form 7） | `your-name` に placeholder「姓」、`your-name2` に「名」。`kana` / `kana2` に「セイ」「メイ」。同意は `acceptance-1`（文言に「同意」が無い）と `acceptance-3`。電話は `maxlength=11`「ハイフン無し」。サイドバーにアーカイブの select（value が URL） | placeholder の姓・名で全体欄を分ける。全体欄の隣に名があれば姓にする（group）。`acceptance` を同意の語に足す。label の「ハイフン無し」に従う。value が URL の select は触らない（選ぶとページが移動する） |
| Salesforce お問い合わせ | B2B 問い合わせ | フォーム全体が別ドメインの iframe | 届かない（下記の制限） |
| Amazon 住所追加（手元の Chrome で抜き出し） | EC の配送先 | `address-ui-widgets-enterAddress…` の camelCase。住所が 市区町村（placeholder「〇〇市〇〇町」）/ 丁目・番地・号（「例：1-2-3」）/ 建物名／会社名 / 部屋番号 の 4 分割。郵便番号は `PostalCodeOne` / `Two`。国/地域の select（Japan 選択済み）は name に住所の語を含む | 欄種 `block`（番地だけ）`room`（部屋番号だけ）`country` を足した。番地だけの欄があれば市区町村の欄に町名まで入れ、部屋番号の欄があれば建物名だけ入れる。`One` / `Two` を分割番号として読む。国は「日本 / Japan / JP」を当て、当たらなければ触らない。select で候補が当たらないとき先頭に落とすのは自由記述系の欄種だけにした（住所の語を持つ国の select で Albania を選ばないように） |

見られなかったもの：Sansan（404）、HubSpot 日本（404）、ニトリ（URL 不明）、ヨドバシ（ログインが要る）。

## 住所の分け方の型

見た範囲で、住所の分け方は 4 つの型に集約できた。欄種の組み合わせで見分け、render が中身を寄せる。

| 型 | 例 | 欄種 | 入れるもの |
|---|---|---|---|
| A | EC-CUBE 4 | `city` / `town` | 千代田区 / 霞が関4-10-12 霞が関ビル 301 |
| B | Amazon | `city` / `block` / `building` / `room` | 千代田区霞が関 / 4-10-12 / 霞が関ビル / 301 |
| C | LoGoフォーム | `city` / `town` / `building` | 千代田区 / 霞が関4-10-12 / 霞が関ビル 301 |
| D | 都道府県の欄が無い 住所1 / 住所2 | `town` / `building` | 東京都千代田区霞が関4-10-12 / 霞が関ビル 301 |

`block` があるとき `city` は町名まで含み、`town` は番地を含まない。`room` があるとき `building` は建物名だけ。

## 分かった制限

- **別ドメインの iframe の中には届かない**。Salesforce のように埋め込みフォームがそうなっている。`executeScript` を `allFrames: true` にすれば注入はできるが、seed の管理と返事の集約が要る。今は未対応
- **readonly の input で作られたドロップダウン**（Vuetify / MUI の select）には書けない。readonly は触らない欄として落としている。開いて選ぶ操作が要る
- **`div[role=radio]` / `div[role=checkbox]`**（Google フォーム）は input ではないので集めない
- **郵便番号→住所の補完は `keyup` で動くものが多い**（yubinbango、ajaxzip3）。この拡張はキーイベントを投げないので補完は動かず、住所は自分で埋める。結果は同じ実在の組になる

## 次に見たいもの

- Shopify / BASE / STORES のチェックアウト（カートに入れないと出ない）
- Amazon の住所追加（ログインが要る）。`address-ui-widgets-enterAddressPostalCode` のような camelCase の長い name
- 予約系（ホテル・航空券）の搭乗者・宿泊者入力
- ふりがな自動入力（autokana）が入ったフォームで、カナ欄が空のまま残らないか

## 抜き出し方

1. 調べたいフォームのページで DevTools を開く
2. `scripts/capture-form.js` の中身をコンソールに貼る。JSON がコンソールに出る
3. `tests/fixtures/forms/<site>.json` に保存する。長い checkbox 群は 1〜2 つに間引いてよい
4. `tests/domain/forms.test.ts` の `EXPECTED` に、手で確かめた欄種を足す
5. `npm test`。外れた欄を直し、直した理由をこのファイルに足す
