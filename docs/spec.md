# jp-dummy-fill 仕様書

日本語のフォームに、通るダミーデータを 1 クリックで入れる Chrome 拡張。

このファイルは実装の起点。欄の判定ルールは `docs/field-rules.md`、住所データは `data/` を参照する。

---

## 1. 一言で

> 日本のフォームは英語圏のダミー入力ツールでは通らない。フリガナは全角カタカナ、郵便番号は 3+4 に分割、電話は 3 分割、都道府県は select、郵便番号を入れると住所が補完される。jp-dummy-fill は、それを全部知っている。

### Principles（README にそのまま載せる）

- **警告を出さない**。権限は `activeTab` `scripting` `contextMenus` の 3 つ。「すべてのウェブサイトのデータを読み取り・変更」は出ない
- **何も送らない、何も残さない**。外部通信ゼロ。`storage` も使わない
- **足さない**。設定画面なし、アカウントなし、課金なし
- **通る**。日本のフォームのバリデーションと補完を前提に値を作る
- **架空**。個人に当たらない値を使う。実在するのは郵便番号と町域まで

### 非目標

- 自分の本当の住所を保存して入れる（Chrome の自動入力や Formin の領分）
- 英語圏のフォーム（Fake Filler の領分。名前は日本語のみ）
- ページ常駐、フォーム検出の自動起動
- 上書きモード（既に値がある欄は常に飛ばす）

---

## 2. 使い方（ユーザーから見える全部）

入口は 3 つ。どれも activeTab が付く。

| 入口 | 動作 |
|---|---|
| ツールバーのアイコン | このページに入力 |
| 右クリックメニュー | 下記 3 項目 |
| ショートカット | `Ctrl/Cmd+Shift+Y`：入力、`Ctrl/Cmd+Shift+U`：住所を遠隔地・離島に替える…、`Ctrl/Cmd+Shift+K`：この欄にデータを埋める…（衝突は実装時に `chrome://extensions/shortcuts` の既定と照合して決め直してよい） |

右クリックメニュー（`contexts: ["page", "editable"]`）。2026-09-06 に整理した（§9a）：

```
このページに入力
住所を遠隔地・離島に替える…
この欄にデータを埋める…
```

- **入力**：ページを開いた時刻で決まる人物（§6）で、空いている欄を埋める。開き直せば別の人
- **住所を替える**：場所を選ぶパレットを開く（§9a）。選ぶと人物はそのまま、住所の欄を上書きする
- **この欄にデータを埋める**：右クリックした欄のそばにパレットを開き、欄種を選んで上書きで入れる（§9b）

seed はページ内（注入スクリプトの変数）に持つ。リロードで 0 に戻る。タブが違えば別カウント。

**都道府県が既に選ばれているフォーム**では、その県の住所で埋める。ユーザーが先に select だけ手で選べば、狙った県になる。

完了時はアイコンのバッジに入れた欄数を 2 秒だけ出す。入れられなかったときは理由をツールチップに出す（特権ページ、ウェブストア、file: の権限）。

---

## 3. 動作フロー

```
[Service Worker]
  入口 → isFillable(url) で弾く → executeScript(content.js) → sendMessage({type:"fill", mode, seed?})

[content.js]
  1. collect     : ページの input / select / textarea を集め、FieldInfo に正規化      presentation
  2. classify    : FieldInfo → FieldKind（docs/field-rules.md §1〜§2）             domain
  3. group       : 分割欄をまとめる（§3）                                            domain
  4. constrain   : 既に選ばれている都道府県があれば Person 生成の制約にする          domain
  5. generate    : seed と制約から Person を作る（§4）                               domain
  6. render      : 欄種 × Person → 文字種・書式を整えた値（§5）                      domain
  7. write       : 郵便番号欄を先に書いて 300ms 待ち、その時点で空の欄だけ書く       presentation
  7b. append     : 補完が町域までしか入れなかった住所欄に、番地を追記する           presentation
  8. report      : 入れた欄数を Service Worker に返す
```

`write` の要点：

- `value` は React / Vue の制御コンポーネント対策で、プロトタイプの native setter 経由で入れる
- 発火するイベントは `input` `change` `blur`。`keydown` `keyup` は投げない（autokana 系のふりがな自動入力を誤作動させない）
- `select` は `value` 一致 → 表示テキスト一致 → 部分一致の順で option を探す
- radio / checkbox は `click()` ではなく `checked = true` + `change`
- 郵便番号を先に書くのは、ページ側の郵便番号→住所補完（yubinbango, ajaxzip3）に住所を埋めさせるため。補完が入れた値と自前の値は同じ実在の組なので、どちらが勝っても同じ結果になる
- **番地の追記**（7b）：補完ライブラリの多くは町域までしか入れず、番地はユーザーに書かせる。待ったあと、`town` / `address_full` / `city` の欄種で「値があり、その値が Person の町域で終わっていて、数字を含まない」ものには、末尾に番地を足す（建物欄が無ければ建物も）。「値がある欄は飛ばす」の唯一の例外で、追記のみ。値が町域で終わっていなければ、ユーザーが書いたものとみなして触らない

触らない欄（`docs/field-rules.md` §2.9）：hidden / submit / button / file / disabled / readonly / 画面外 / csrf・token・captcha を含む name / 既に値がある欄。

---

## 4. 構成

3 層。domain は DOM も `chrome.*` も触らない純粋関数だけ。

```
src/
  background.ts                 入口 3 つ。application に渡すだけ
  content.ts                    注入スクリプト。同じページへの二重注入に耐える
  domain/
    protocol.ts                 SW ⇄ content のメッセージ型
    target.ts                   isFillable(url)。特権ページ・ウェブストアを弾く
    field.ts                    FieldInfo, FieldKind の型
    classify.ts                 FieldInfo → FieldKind（§1〜§2）
    group.ts                    分割欄のグルーピング（§3）
    person.ts                   Person 型と generate(seed, constraint)
    render.ts                   (kind, person, field) → string（§5）
    kana.ts                     ひらがな⇄カタカナ⇄半角カナ、全角⇄半角
    wareki.ts                   西暦⇄和暦
    random.ts                   seed 付き乱数（mulberry32 程度でよい）
    data/
      addresses.ts              data/addresses.json を型付きで re-export
      names.ts                  data/names.json を型付きで re-export
  application/
    fill.ts                     startFill(tab, mode)
    i18n.ts                     chrome.i18n の薄い包み
    notify.ts                   バッジとツールチップ
  presentation/
    collect.ts                  DOM → FieldInfo[]
    write.ts                    値の書き込みとイベント発火
data/
  addresses.src.json            手で管理する元リスト（zip / kind / zone / areaCode / note、離島は name / nameKana）65 件
  addresses.json                生成物。町名・読み付き。拡張が読むのはこれ
  names.json                    姓 100・名 男女各 50。読み付き
docs/
  field-rules.md                欄の判定ルール
  spec.md                       このファイル
tests/
  domain/*.test.ts              domain の全関数
  fixtures/jp-form-test.html    手動確認用のフォーム（§6 の name 属性を順次足す）
public/
  manifest.json
  _locales/{en,ja}/messages.json
  icons/
```

### FieldInfo（presentation が作り、domain が読む）

```ts
type FieldInfo = {
  index: number;            // DOM 順
  tag: "input" | "select" | "textarea";
  type: string;             // input の type。select/textarea は ""
  name: string;
  id: string;
  autocomplete: string;
  inputmode: string;
  pattern: string;
  maxlength: number | null;
  label: string;            // for= / aria-labelledby / 包む label / 直前テキスト を連結
  placeholder: string;
  ariaLabel: string;
  options: { value: string; text: string }[];  // select のみ
  checked: boolean;         // radio / checkbox
  hasValue: boolean;        // 既に値があるか
  visible: boolean;
};
```

### Person

```ts
type Person = {
  sex: "male" | "female";
  family: string; given: string;             // 漢字
  familyKana: string; givenKana: string;     // ひらがなで持つ。表示時に変換
  address: Address;                          // data/addresses-*.json の 1 件
  block: string;                             // 番地。"1-2-3"
  building: string;                          // "霞が関ビル 4F"
  mobile: string;                            // "090-0XXX-XXXX"
  landline: string;                          // areaCode + 1 始まりの市内局番
  email: string;                             // given.family@example.jp
  password: string;                          // 固定
  birth: { y: number; m: number; d: number };
  company: string; department: string; title: string;
  url: string;
};
```

同じ seed からは必ず同じ Person が出ること。テストで固定する。

---

## 5. データ

| ファイル | 内容 | 状態 |
|---|---|---|
| `data/addresses.src.json` | 手で管理する元リスト。`zip / kind / zone / areaCode / note`、離島は `name / nameKana`。中心 47・離島 18（§9a で遠隔 94 を外した） | 済 |
| `data/addresses.json` | 生成物。元リストの各 zip を日本郵便のデータで引いて `pref / city / town` と `prefKana / cityKana / townKana`（全角カタカナ、数字は半角）を足したもの。拡張が読むのはこれ。市外局番は各行の `areaCode` | 済 |
| `data/names.json` | 姓 100 / 名 男女各 50。`[漢字, ひらがな]` | 済 |

`zone` は `main / hokkaido / okinawa / island`。石垣は `okinawa` かつ `island` なので配列にする。

郵便番号・都道府県・市区町村・町域は日本郵便の郵便番号データで実在確認したものだけ。番地・建物は架空。

`scripts/build-addresses.ts` が `data/addresses.src.json` → `data/addresses.json` を再生成する。日本郵便の郵便番号データを同梱した npm `yubin` で zip を引き、町名と読みを埋め、括弧書き（「次のビルを除く」など）を除去し、読みの数字を半角にする。引けない zip や事業所個別番号があれば失敗させる。`yubin` は devDependency で、拡張本体には入れない。今の `addresses.json` はこの手順で作ったもの。

住所フリガナは `prefKana + cityKana + townKana + 番地` を、欄の文字種規則（`docs/field-rules.md` §5.1）に従ってカタカナかひらがなで入れる。番地の数字はそのまま。

電話番号：

- 携帯 `090-0XXX-XXXX`。09000〜09009 は未指定帯。080-0 は 0800 フリーダイヤルと衝突するので使わない
- 固定 `0 + 市外局番 + 1 で始まる市内局番 + 4 桁`。市内局番は 0・1 で始まらない決まりなので実在しない。市外局番の長さで区切りを変える（03-1234-5678 / 045-123-4567 / 0776-12-3456）

メール：`example.jp`（JPRS の例示用予約ドメイン）。

---

## 6. 決定済みの仕様

| 論点 | 決定 |
|---|---|
| プロフィール | ページを開いた時刻から seed を決める（`domain/seed.ts`、2026-01-01 からの分数）。seed はページ内。「固定データで入力」「別人で入力」は置かず、別の人物が欲しければページを開き直す。**2026-09-06 に「固定 seed 0」から変更**。固定だと会員登録のテストで同じメールアドレスが二度目に弾かれる。同じ人物が要る場面（登録したアカウントに入り直す）は、メールアドレスとユーザー名に付いた番号をパレットに打って呼び戻す |
| ヒント無しのカナ | カタカナ。label / placeholder / name / pattern にヒントがあればそれが勝つ |
| 同意以外の checkbox | 触らない。同意（規約・プライバシー）だけ ON |
| 値がある欄 | 飛ばす。上書きモードは作らない |
| 電話 | 制度上存在しない番号（上記） |
| 住所 | 実在の組。都道府県ごとの中心 1 と、選べる離島 18。番地は架空 |
| storage | 使わない |

---

## 7. i18n

`public/_locales/{en,ja}/messages.json`。ストアの表示名も言語別。

| key | en | ja |
|---|---|---|
| appName | jp-dummy-fill | jp-dummy-fill |
| appDesc | Fill Japanese forms with test data that passes validation. Kana, split postal codes, prefecture selects, era dates. | 日本語フォームにテストデータを入力。フリガナ、郵便番号の分割、都道府県、和暦に対応 |
| menuFill | Fill this page | このページに入力 |
| menuAddress | Change the address to remote / island… | 住所を遠隔地・離島に替える… |
| menuFillOne | Fill this field with… | この欄にデータを埋める… |
| placeHome | Back to the person's own address | 元の住所に戻す |
| placeGroupRegion | Regions with their own shipping rate | 配送料の区分が別の地域 |
| placeGroupIsland | Outlying islands | 離島 |
| placePlaceholder | Type a place name | 地名で絞り込み（さど、おきなわ…） |
| cmdFill | Fill this page | このページに入力 |
| cmdPick | Fill the focused field with… (opens the palette) | フォーカスのある欄に入れる…（パレットを開く） |
| cmdPlace | Change the address to remote / island… | 住所を遠隔地・離島に替える… |
| errUnsupported | This page cannot be filled | このページには入力できません |
| errFileAccess | Turn on "Allow access to file URLs" on the extension's details page | 拡張機能の詳細で「ファイルの URL へのアクセスを許可する」を有効にしてください |

---

## 8. テスト

- **domain**：Vitest。`classify` `group` `generate` `render` `kana` `wareki` を網羅。`generate(0)` の出力をスナップショットで固定する
- **classify のテスト表**：`docs/field-rules.md` §2 の各行につき最低 1 ケース。日本語 label だけで当たるケースを必ず含める
- **fixtures**：`tests/fixtures/jp-form-test.html` を拡張して、§6 の name 属性を全部持たせる。手動で入力して「値を表示」で確認
- **受け入れ**：fixtures の全欄が、セイカナ／メイカナが全角カタカナ、zip1/zip2 が 3+4、tel1/2/3 が分割、都道府県 select が選ばれ、生年月日が和暦で入り、郵便番号と都道府県と市区町村が一致し、住所フリガナ欄に町域までの読みと番地が入っていること
- **補完との共存**：fixtures に yubinbango を組み込んだ版を 1 枚足し、郵便番号だけで住所が埋まったあとに番地が追記され、入力が二重にならないことを確認する

---

## 9. 着手順

1. 雛形：ビルド設定、manifest、`_locales`、`target.ts` `i18n.ts` `notify.ts`、`content.ts` の二重注入対策
2. `domain/field.ts` `domain/classify.ts` ＋ テスト。`docs/field-rules.md` §1〜§2 を写す。ここが一番大きい
3. `domain/group.ts` ＋ テスト（§3）
4. `domain/kana.ts` `domain/wareki.ts` `domain/random.ts` ＋ テスト
5. `domain/person.ts`：`addresses-center.json` と仮の姓名リスト（各 10 件でよい）で `generate`
6. `domain/render.ts` ＋ テスト（§5）
7. `presentation/collect.ts` `presentation/write.ts`、`application/fill.ts`、`background.ts`。ここで初めて Chrome で動かす
8. fixtures で受け入れ確認
9. `scripts/build-addresses.ts` を書いて、`data/addresses.json` が再生成しても一致することを確かめる

2〜6 は Chrome を開かずに進められる。7 まで来たら `chrome://extensions` で読み込んで fixtures を試す。

---

## 9a. メニューの整理（2026-09-06）

当初の 4 項目（入力・別人・遠隔地・離島）を、いちど「入力・固定データ・住所を替える・この欄に
データを埋める」の 4 項目にしたあと、次の 3 項目に落とした。§2 は最終形。

| 項目 | 動き |
|---|---|
| このページに入力 | 開いたときの人物で空欄を埋める。人物は開くたびに変わる（§6） |
| 住所を遠隔地・離島に替える… | 場所を選ぶパレットを開く。選ぶと人物はそのまま、住所系の欄種（`ADDRESS_KINDS`）を上書き |
| この欄にデータを埋める… | パレット（§9b） |

ショートカットは Y（入力）U（住所）K（パレット）。当初の F は Fake Filler の既定と同じで、両方入れていると後から入れた側が未設定になるので Y に移した。Chrome 本体の割り当てと 1Password の X を避け、右手の並びに揃えてある。

**外したもの。** 「別人」は、使い捨ての人物ならページを開き直せば変わるから。「固定データ」は、
常に同じ人物が要る場面が「登録したアカウントに入り直す」くらいしか無く、それはメールアドレス
末尾の番号をパレットに打てば足りるから。しかも固定は二度目の会員登録でメールが弾かれる、
ランダムを入れた理由そのものの欠点を持つ。押すたびに巡る住所の切り替えは、どこへ行くかを
選べないので、選ぶパレットに替えた。

**並べる場所は配送業者の区分に合わせた**（`domain/places.ts`、調査 2026-09-06）。

- ヤマト運輸：離島の追加料金は無い。料金は発地・着地の都道府県（地帯）で決まり、北海道と
  沖縄は別の地帯。離島はお届け日数が延び、クール宅急便が使えない島がある
- 佐川急便：沖縄全域と一覧の島に離島中継料。この一覧を EC サイトの多くが「離島」の定義に使う
- Amazon.co.jp：配送料は「本州・四国」と「北海道・九州・沖縄・離島」の 2 区分

3 社が揃って分けるのは北海道・沖縄・離島（Amazon は九州も）。そこで「配送料の区分が別の地域」
として 北海道（札幌）・九州（福岡）・沖縄本島（那覇）、「離島」として佐川の一覧から名の知れた
18 島を並べる。「同じ県の遠隔地」はどの業者にも区分が無いので、データごと外した
（146 件 → 65 件）。飛島（山形県酒田市）は市の一部だけが離島で、市区町村名では判定できない
例として入れてある。

離島は都道府県の select を離島の県に書き換えるので、「元の住所に戻す」で select を読むと
離島の県の中心になってしまう。中心から離れる最初の一歩で起点の都道府県を控え
（`homePrefecture`）、`Variant.pref` で select より優先して戻す。

## 9b. 欄を指定して入れる（2026-09-06 追加）

判定が外した欄の逃げ道。右クリックメニューの「この欄にデータを埋める…」（または `Ctrl/Cmd+Shift+K`）で、欄のそばに欄種を選ぶパレット（`presentation/palette.ts`、Shadow DOM）を開く。入力で絞り込み、Enter で入る。「しく」→ 市区町村、「せい」→ フリガナ（セイ）。並べる欄種と見出しは `domain/menu.ts`。

メニューに欄種を並べる案は捨てた。Chrome が拡張の項目を名前の下に畳むので 4 段になり、探して辿るだけで用が済まなくなる。

- Service Worker は `{type:"pick", via}` を送るだけ。どの欄かは送らない。Chrome の右クリックメニューは押された要素を教えないので、コンテンツスクリプトが `contextmenu` イベントで覚えておき、初回（未注入）は `document.activeElement` で補う。ショートカットから来たときはフォーカスのある欄を先に見る
- パレットを開いた時点で返事は `{ok:true, opened:true}`。人が選び終わるのを待たないので、バッジには何も出ない。結果は目の前の欄に出る
- 値は直前の入力と同じ人物（seed と住所の選び方をページ内に覚えておく）から、その欄の書式規則で作る。周りの欄の判定はそのまま行い、選んだ欄だけ欄種を差し替える（`plan.ts` の `planOne`）
- **上書きする**。§1 の「値がある欄は常に飛ばす」の唯一の例外。人が欄を名指しで選んでいるので、消してよい値かの判断も人がしている
- 手で選んだ欄は、規則が何と判定していたかと一緒に `console.debug` に出す。保存はしない。規則を育てる材料

## 10. 後回し（TODO として Issue に）

- 京都の通り名表記
- 法人番号（13 桁チェックデジット）、クレジットカードのテスト番号
- 半角カナの生成
- Firefox 対応
