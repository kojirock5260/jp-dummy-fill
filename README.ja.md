# jp-dummy-fill

[English](README.md)

日本語のフォームに、通るダミーデータを 1 クリックで入れる Chrome 拡張。

## 思想

- **警告を出さない**。権限は `activeTab` / `scripting` / `contextMenus` のみ
- **何も送らない、何も残さない**。外部通信ゼロ。`storage` も使わない
- **足さない**。設定画面なし、アカウントなし、課金なし
- **通る**。フリガナの文字種、郵便番号・電話の分割、都道府県の select、郵便番号→住所補完を前提に値を作る
- **架空**。実在するのは郵便番号と町域まで

## プライバシー

収集も送信もしない。押したタブのフォーム欄を読み、空いている欄に書くだけ。
詳細は [プライバシーポリシー](PRIVACY.md)（英語）を参照。

## インストール

Chrome Web Store: <https://chromewebstore.google.com/detail/jp-dummy-fill/likiphcnpamhfafnnehfhnjgbonaafpb>

変更は [変更履歴](CHANGELOG.ja.md) を参照。

## 開発

```bash
npm install
npm run build       # dist/ に出力
npm test            # Vitest
npm run lint        # Biome
npm run data        # 日本郵便のデータから data/addresses.json を作り直す
```

1. `chrome://extensions` を開く
2. 右上「デベロッパーモード」を ON
3. 「パッケージ化されていない拡張機能を読み込む」→ `dist/`

`tests/fixtures/jp-form-test.html` で試せる。

## 使い方

| 入口 | 動作 |
|---|---|
| ツールバーのアイコン | このページに入力 |
| 右クリックメニュー | 下記 3 項目 |
| `Cmd+Shift+Y` / `U` / `K` | 入力 / 住所を替える / この欄にデータを埋める（Windows / Linux は `Ctrl`） |

| 項目 | 動き |
|---|---|
| このページに入力 | 空いている欄を一人ぶんのデータで埋める。人はページを開くたびに変わる |
| 住所を遠隔地・離島に替える… | 場所を選ぶと、住所の欄だけをその場所に書き換える。送料のテスト用 |
| この欄にデータを埋める… | 右クリックした欄に、選んだ種類の値を上書きで入れる。判定が外れた欄の直し方 |

パレットは数文字で絞れる。「さど」→ 佐渡島、「しく」→ 市区町村。

**住所の候補**：北海道、九州、沖縄本島、離島 18（礼文島、奥尻島、飛島、伊豆大島、八丈島、父島、佐渡島、隠岐、小豆島、対馬、福江島、屋久島、奄美大島、与論島、宮古島、石垣島、与那国島、南大東島）。区分はヤマト運輸・佐川急便・Amazon.co.jp の送料区分に合わせた。

**同じ人を出し直す**：メールアドレス末尾の番号（`shou.abe.4213@example.jp` の 4213）をパレットに打つ。

**値がある欄は飛ばす**。書き換えるのは上の 2 つのパレットだけ。都道府県が選ばれていればその県の住所になる。checkbox は同意だけ ON。

## 何が入るか

| 欄 | 例 |
|---|---|
| 氏名・カナ | 阿部 翔 / アベ ショウ。label がひらがなならひらがな |
| 郵便番号 | 100-0013。7 桁欄なら 1000013、分割なら 100 / 0013 |
| 住所 | 東京都 / 千代田区霞が関4-10-12 / 霞が関ビル 301。欄の分け方に合わせる |
| 電話・FAX | 090-0947-6865（3 分割にも対応）/ 03-1234-5678 |
| メール・パスワード | shou.abe.4213@example.jp / `Dummy!Pass01`。確認欄も同じ値 |
| 生年月日・年齢・性別 | 1984-07-18（和暦 select なら 昭和 59）/ 42 / 男性 |
| 会社 | 阿部商事株式会社、営業部、課長 |
| 自由記述 | 日本語 2〜3 文 |
| クレジットカード | 4242 4242 4242 4242（Stripe のテスト番号）/ SHOU ABE / 12/29 / 123 / VISA |
| 法人番号・インボイス | 検査用数字が通る 13 桁 / T ＋ 13 桁 |
| ローマ字氏名 | SHOU ABE。例が「Taro Yamada」なら Shou Abe |
| 希望日 | 1 週間後の平日 |

電話番号は制度上存在しない帯。`example.jp` は JPRS の例示用ドメイン。カード番号はテスト用で、本番の決済には通らない。

## 構成

```
src/
  domain/        ルール。DOM も chrome.* も触らない（docs/field-rules.md）
  application/   ブラウザ API 越しの副作用
  presentation/  DOM から集める（collect）、DOM へ書く（write）、パレット
  background.ts  Service Worker
  content.ts     注入されるスクリプト
data/            住所 65 件、姓 100・名 100
docs/            仕様、判定ルール、実サイト調査
tests/fixtures/  試験用フォームと、実サイト 8 件の欄構造
```

## Notes

- 英語のフォームは対象外
- 郵便番号→住所補完（yubinbango、ajaxzip3）とは共存する。郵便番号を先に書き、補完が埋めた欄は触らない
- 別ドメインの iframe、readonly input のドロップダウン、`div[role=radio]` には入れられない
- ウェブストア、`chrome://`、権限 OFF の `file://` では動かない。アイコンに `!` が出る
- `Cmd+Shift+F` を使わないのは Fake Filler の既定と重なるため

## Contributing

セキュリティ方針として、**Pull Request は一旦受け付けていません。**
バグ報告や提案は Issue へ。

## 開発について

このプロジェクトは [Claude](https://claude.com)（Anthropic）を活用して開発しています。
