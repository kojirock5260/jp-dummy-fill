# 欄判定ルール v0

日本語フォーム用ダミー入力拡張の中核。「どの欄を何と見なし、どの文字種・書式で入れるか」を決める。
`domain/` 層に置く純粋関数の仕様として書いている。DOM も chrome.* も出てこない。

---

## 0. 全体の流れ

```
1. ページから入力欄を集める（presentation 層）
   → 欄ごとに { name, id, type, autocomplete, inputmode, pattern, maxlength,
                label, placeholder, ariaLabel, options[] } を抜き出す
2. 各欄を「欄種」に分類する                    ← このドキュメントの §2
3. 分割欄をグループにまとめる                   ← §3
4. 一人ぶんの Person を生成する                 ← §4
5. 欄種ごとに Person から値を取り、文字種・書式を整える ← §5
6. 書き戻す（presentation 層。input / change / blur イベント発火）
   6a. 郵便番号欄を先に書く → 数百 ms 待つ
   6b. その時点で空の欄だけ書く（「値がある欄は飛ばす」の規則がここで効く）
   6c. 補完が町域までしか入れなかった住所欄に番地を追記する（唯一の例外。§2.3 の注記）
```

要点は 4 → 5 の順序。**先に一人ぶん作ってから配る**。欄ごとに独立に乱数を引くと、郵便番号と都道府県が食い違う（FakeFill JP がそうなっている）。

6a → 6b はページ側の郵便番号→住所補完（yubinbango, ajaxzip3 など）との共存のため。補完があるフォームでは補完に任せ、無いフォームでは自分で入れる。データが同じ実在の組なので、どちらでも結果は同じになる。ふりがな自動入力（autokana 系）はキー入力を拾う仕組みなので、値の直接セットでは動かない。keyup は投げない。

---

## 1. 判定に使うシグナルと優先順位

Chrome 自動入力のヒューリスティックに合わせる。上にあるものが勝つ。

| 順 | シグナル | 使い方 |
|---|---|---|
| 1 | `autocomplete` 属性 | 標準値なら確定。`off` は無視して次へ |
| 2 | `type` / `inputmode` | `email` `tel` `url` `date` `password` `number` は欄種をほぼ確定。`inputmode` は文字種のヒント |
| 3 | `name` / `id` | トークン照合（§2 の表）。`[]` `-` `_` `.` で分割し小文字化。末尾の数字は分割インデックスとして保持（`zip1` → base `zip`, idx `1`） |
| 4 | `label` | `for=` で結んだ label、`aria-labelledby`、包んでいる label、同じ行の直前テキスト。日本語トークンはここが本命 |
| 5 | `placeholder` / `aria-label` | label と同じ扱い。文字種判定にも使う（§5） |
| 6 | `class` | **既定では見ない**。Fake Filler が class を見て誤爆が多かった。オプションで ON にできる程度 |

同じ欄が複数の欄種に当たったときの優先：

- **カナ系 > 氏名系**（`sei_kana` は kana トークンを含むので kana 側）
- **確認系 > 元の欄**（`email_confirm` は email_confirm）
- **分割インデックスあり > なし**（`tel1` は tel の分割 1）
- 会社系トークン（`company` `corp` `法人` `会社`）が同居していれば個人名ではなく会社名系

---

## 2. 欄種とトークン

トークンは部分一致。英字は小文字化した name/id/autocomplete に対して、日本語は label/placeholder/aria-label に対して照合する。

### 2.1 氏名

| 欄種 | name / id トークン | label / placeholder トークン | autocomplete | 値の例 |
|---|---|---|---|---|
| `name_full` | `name` `fullname` `full_name` `shimei` `simei` `onamae` | 氏名 お名前 名前 ご氏名 | `name` | 山田 太郎 |
| `name_family` | `sei` `last_name` `lastname` `lname` `family_name` `familyname` `surname` `myoji` `myouji` `last` | 姓 苗字 名字 | `family-name` | 山田 |
| `name_given` | `mei` `first_name` `firstname` `fname` `given_name` `givenname` `given` `first` | 名 | `given-name` | 太郎 |

- `name` 単体は `name_full`。ただし同じフォーム内に `name_family` / `name_given` があるなら `name` は無視候補（`name="name"` を持つ別用途の欄が多い）。
- 「名」1文字は「氏名」「会社名」「建物名」にも含まれる。label が **ちょうど**「名」または「名（漢字）」のときだけ `name_given`。

### 2.2 カナ

| 欄種 | name / id トークン | label / placeholder トークン | autocomplete | 値の例 |
|---|---|---|---|---|
| `kana_full` | `kana` `furigana` `hurigana` `yomi` `yomigana` `ruby` `phonetic` `name_kana` `namekana` `full-name-phonetic` | フリガナ ふりがな よみがな カナ セイメイ せいめい 読み | `name`（Chrome 流用） | ヤマダ タロウ |
| `kana_family` | `sei_kana` `kana_sei` `last_name_kana` `lastname_kana` `family_name_kana` `family-name-phonetic` `sei_furigana` | セイ せい 姓（フリガナ） 姓（カナ） 姓ふりがな | `family-name` | ヤマダ |
| `kana_given` | `mei_kana` `kana_mei` `first_name_kana` `firstname_kana` `given_name_kana` `given-name-phonetic` `mei_furigana` | メイ めい 名（フリガナ） 名（カナ） 名ふりがな | `given-name` | タロウ |
| `company_kana` | `company_kana` `corp_kana` `kaisha_kana` | 会社名（フリガナ） 法人名（カナ） | — | ヤマダショウジ |

- autocomplete は Chrome と同じで氏名系と共用なので、**autocomplete だけでは氏名とカナを区別できない**。name / label で決める。
- 文字種（カタカナ／ひらがな／半角カナ）は §5.1。

### 2.3 住所

| 欄種 | name / id トークン | label / placeholder トークン | autocomplete | 値の例 |
|---|---|---|---|---|
| `postal` | `zip` `zipcode` `zip_code` `postcode` `postal` `postal_code` `postalcode` `yubin` `yuubin` | 郵便番号 〒 | `postal-code` | 100-0001 |
| `postal_1` / `postal_2` | base が `postal` で idx 1 / 2、または `zip_a`/`zip_b` `zip_first`/`zip_second` `zip_upper`/`zip_lower` `zip3`/`zip4`（桁数で名付ける流儀） | 郵便番号（前3桁）/（後4桁） | — | 100 / 0001 |
| `prefecture` | `pref` `prefecture` `todofuken` `todouhuken` `ken` `state` `region` `province` `address_level1` `addr_pref` | 都道府県 | `address-level1` | 東京都 |
| `city` | `city` `shikuchoson` `shiku` `address_level2` `addr_city` `municipality` | 市区町村 市区郡 市町村 | `address-level2` | 千代田区 |
| `town` | `town` `street` `address_line1` `addressline1` `address1` `addr1` `banchi` `chome` `address_detail` | 町名 番地 町名・番地 丁目 住所1 それ以降の住所 | `address-line1` | 千代田1-2-3 |
| `building` | `building` `tatemono` `address_line2` `address2` `addr2` `room` `mansion` `apartment` | 建物名 マンション名 部屋番号 号室 住所2 | `address-line2` | 千代田ビル 403 |
| `address_full` | `address` `jusho` `juusho` `addr`（分割系トークンが無いとき） | 住所 ご住所 | `street-address` | 東京都千代田区千代田1-2-3 千代田ビル 403 |
| `address_kana` | `address_kana` `addr_kana` `jusho_kana` `address_furigana` | 住所（フリガナ） 住所フリガナ 住所カナ ご住所（カナ） | — | トウキョウトチヨダクチヨダ1-2-3 |
| `prefecture_kana` / `city_kana` / `town_kana` | `pref_kana` `city_kana` `town_kana` `address1_kana` | 都道府県（カナ） 市区町村（カナ） 町名（カナ） | — | トウキョウト / チヨダク / チヨダ1-2-3 |

- `address1` `address2` は「町名・番地」「建物」の意味で使われることが多いが、「住所1 = 都道府県+市区町村」「住所2 = それ以降」の流儀もある。同じフォームに `prefecture` があれば前者、無ければ `address1` を「市区町村+町名・番地」に寄せる。
- `state` は米国流儀。日本語ページなら `prefecture` として扱う。
- 住所カナは `kana` トークンと住所系トークンの両方を持つ欄。氏名カナより先に判定する（`address_kana` が `kana_full` に化けない）。文字種は §5.1 と同じ規則で決める。番地の数字はそのまま。
- **番地の追記**：郵便番号を先に入れて待ったあと、`town` / `address_full` / `city` の欄に値があり、その値が Person の町域で終わっていて数字を含まないなら、末尾に番地（建物欄が無ければ建物も）を足す。町域で終わっていなければユーザーの入力とみなして触らない。

### 2.4 電話・FAX

| 欄種 | name / id トークン | label / placeholder トークン | autocomplete | 値の例 |
|---|---|---|---|---|
| `tel` | `tel` `phone` `telephone` `mobile` `cellphone` `keitai` `denwa` `contact_number` | 電話番号 携帯電話 携帯番号 TEL 連絡先電話 | `tel` | 090-1234-5678 |
| `tel_1` / `tel_2` / `tel_3` | base `tel` で idx 1/2/3、`tel_a/b/c`、`tel_area`/`tel_local`/`tel_number` | 市外局番 市内局番 加入者番号 | `tel-area-code` `tel-local-prefix` `tel-local-suffix` | 090 / 1234 / 5678 |
| `fax` | `fax` `facsimile` | FAX ファックス | — | 03-1234-5678 |

- `mobile` `keitai` `携帯` を含むなら 070/080/090 固定。それ以外は §4 の既定。
- FAX は固定電話番号の書式で。

### 2.5 メール・パスワード・ID

| 欄種 | name / id トークン | label / placeholder トークン | type / autocomplete | 値の例 |
|---|---|---|---|---|
| `email` | `email` `mail` `e-mail` `mailaddress` `mail_address` | メールアドレス メール Eメール | `type=email` / `email` | taro.yamada@example.jp |
| `email_confirm` | `email_confirm` `confirm_email` `email2` `email_check` `mail_confirm` `re_email` | メールアドレス（確認） 確認用 再入力 | — | email と同じ値 |
| `password` | `password` `passwd` `pass` `pw` `pwd` | パスワード | `type=password` / `new-password` `current-password` | 固定の1本（§4） |
| `password_confirm` | `password_confirm` `confirm_password` `password2` `re_password` | パスワード（確認） | — | password と同じ値 |
| `username` | `username` `user_name` `login_id` `user_id` `account` `account_id` `nickname` `handle` | ユーザー名 ユーザーID ログインID ニックネーム アカウント名 | `username` `nickname` | yamada_taro |

- `email_confirm` は `email` の後ろに出る 2 番目の email 欄でも判定する（トークンが無いフォームが多い）。password も同様。

### 2.6 生年月日・年齢・性別

| 欄種 | name / id トークン | label / placeholder トークン | type / autocomplete | 値の例 |
|---|---|---|---|---|
| `birth` | `birth` `birthday` `birthdate` `birth_date` `dob` `date_of_birth` `seinengappi` | 生年月日 誕生日 | `type=date` / `bday` | 1990-05-14 |
| `birth_y` | base `birth` + `y` `year` `yy` `yyyy`、`bday_year`、または `year` 単体 | 年 | `bday-year` | 1990 |
| `birth_m` | base `birth` + `m` `month` `mm`、`bday_month`、`month` 単体 | 月 | `bday-month` | 5 |
| `birth_d` | base `birth` + `d` `day` `dd`、`bday_day`、`day` 単体 | 日 | `bday-day` | 14 |
| `era` | `era` `gengo` `wareki` `nengo` | 元号 和暦 | — | 平成 |
| `age` | `age` `nenrei` | 年齢 | — | 34 |
| `gender` | `gender` `sex` `seibetsu` | 性別 | `sex` | 男性 / 女性 |

- `year` `month` `day` 単体は、同じフォームに `birth` 系トークンが無くても、3 つ揃っていれば生年月日として扱う。
- `era` があれば `birth_y` は和暦年で入れる（§5.3）。
- `gender` は Person の性別に合わせて radio / select を選ぶ。名前の読みとも整合させる。

### 2.7 会社・肩書

| 欄種 | name / id トークン | label / placeholder トークン | autocomplete | 値の例 |
|---|---|---|---|---|
| `company` | `company` `company_name` `corp` `corporation` `organization` `org` `kaisha` `kigyo` `hojin` | 会社名 企業名 法人名 団体名 貴社名 御社名 | `organization` | 山田商事株式会社 |
| `department` | `department` `dept` `busho` `division` `section` | 部署 部署名 所属 | — | 営業部 |
| `job_title` | `job_title` `title` `position` `yakushoku` `role` | 役職 肩書 | `organization-title` | 課長 |
| `url` | `url` `website` `web_site` `homepage` `hp` `site` | URL ホームページ サイト | `type=url` / `url` | https://example.jp/ |

### 2.8 自由記述・その他

| 欄種 | 判定 | 値 |
|---|---|---|
| `message` | `<textarea>`、または `message` `comment` `inquiry` `naiyo` `naiyou` `body` `remarks` `bikou` / お問い合わせ内容 ご要望 備考 コメント メッセージ | 2〜3文の日本語（lorem ipsum は使わない） |
| `agree` | checkbox で `agree` `consent` `terms` `kiyaku` `privacy` / 同意 規約 承諾 | **ON** |
| `number` | `type=number` | `min`〜`max` の範囲内。無ければ 1〜100 |
| `select` | 上記のどれにも当たらない `<select>` | 空 / 「選択してください」系を除いた先頭。都道府県・元号・性別は該当欄種に従う |
| `radio` | 上記のどれにも当たらない radio グループ | 先頭を選ぶ（性別は Person に従う） |
| `checkbox` | `agree` 以外 | **触らない**（§7 で要決定） |
| `text` | 何にも当たらない text | 短い日本語 1 語〜1 文 |

### 2.9 触らない欄

- `type` が `hidden` `submit` `button` `reset` `image` `file` `range` `color`
- `disabled` `readonly`
- name/id に `csrf` `token` `_token` `authenticity_token` `captcha` `recaptcha` `honeypot` `nonce`
- 画面外・`display:none` の欄（presentation 層で除外。honeypot 対策）
- 既に値が入っている欄（既定。オプションで上書き可）

---

## 3. 分割欄のグルーピング

`name` / `id` の末尾インデックス、または `_a/_b/_c` `_first/_second` `_upper/_lower` を剥がして base を取り、同じ base で束ねる。

| base | 個数 | 割り当て |
|---|---|---|
| `postal` | 2 | 前3桁 / 後4桁 |
| `tel` | 3 | 090 / 1234 / 5678（携帯 3-4-4） |
| `tel` | 2 | 090-1234 / 5678 は稀。`maxlength` を見て 6+4 か 3+8 か決める。決められなければ全体を 1 つ目に |
| `birth` | 3 | 年 / 月 / 日 |
| `name` | 2 | 姓 / 名（`name1` `name2` の流儀） |
| `kana` | 2 | セイ / メイ |
| `address` | 2〜3 | `address1` = 町名・番地、`address2` = 建物（§2.3 の注意参照） |

インデックスが無くても、**同じ欄種が DOM 順で連続していれば分割とみなす**（`zip` `zip` のように同名が 2 つ、や、`maxlength=3` の直後に `maxlength=4`）。

---

## 4. Person の生成と整合

1 回の入力で使うのは 1 人。以下を一括で生成する。

| 項目 | 生成方法 |
|---|---|
| 性別 | ランダム（オプションで固定） |
| 姓・名 | 読み付きリストから。名は性別別。リストは自前（faker の ja には読みが無い） |
| 読み | ひらがなで持ち、欄の文字種に合わせて変換（§5.1） |
| 郵便番号・都道府県・市区町村・町域 | **実在する組のリスト**から 1 件（各都道府県に数件、計 100〜200 件）。郵便番号→住所補完が入っているフォームでも通る |
| 番地 | `1-2-3` 形式の架空値 |
| 建物 | 「○○ビル 403」の架空値 |
| 電話 | 携帯 `0[789]0-XXXX-XXXX`。固定は 都道府県に合う市外局番（03 / 06 など）+ 架空の局番 |
| メール | `{given}.{family}@example.jp`。`example.jp` は JPRS 予約の例示用ドメイン |
| パスワード | 固定文字列 1 本（大文字小文字数字記号を含む 12 桁）。ランダムにすると確認欄と合わせづらい上、テストで再入力できない |
| 生年月日 | 20〜65 歳になる日付 |
| 年齢 | 生年月日から算出 |
| 会社・部署・役職 | 「{姓}商事株式会社」「営業部」「課長」 |

「同じ人を何度でも」を既定にするか、毎回変えるかは §7。

---

## 5. 文字種と書式

### 5.1 カナの文字種

Chrome 自動入力と同じ規則を採る。

1. label / placeholder に **カタカナが 1 文字でもあれば カタカナ**（「フリガナ」「セイ」「メイ」）
2. それ以外で **ひらがながあれば ひらがな**（「ふりがな」「せい」「めい」）
3. label に無いとき name トークンで： `hiragana` `furigana` → ひらがな、`katakana` `kana` → カタカナ
4. `pattern` に `[ァ-ヶ]` `\u30A1-\u30F6` があればカタカナ、`[ぁ-ん]` `\u3041-\u3096` があればひらがな、`[ｦ-ﾟ]` があれば半角カナ
5. どれも無ければ **カタカナ**（日本のフォームの多数派）

姓と名の間の区切り：`kana_full` は全角スペース。label に「スペースなし」「続けて」があれば詰める。

### 5.2 全角・半角

| 欄種 | 既定 | 切り替え条件 |
|---|---|---|
| 郵便番号 | 半角数字 | label / placeholder に「全角」→ 全角数字 |
| 電話 | 半角数字 | 同上 |
| 番地 | 半角数字 + 半角ハイフン | 「全角」→ `１−２−３` |
| 氏名・カナ・住所文字列 | 全角 | 変えない |
| メール・URL・ID | 半角 | 変えない |

`inputmode="numeric"` `pattern="\d*"` `pattern="[0-9]+"` は半角確定。

### 5.3 ハイフン・区切り

| 欄種 | 判定 |
|---|---|
| 郵便番号（単一欄） | `maxlength` が 7 → ハイフン無し。8 以上、または placeholder に `-` `〒` → ハイフン有り。無指定はハイフン有り |
| 電話（単一欄） | `maxlength` が 10〜11 → 無し。placeholder に `-` → 有り。無指定はハイフン有り |
| 生年月日（単一 text） | placeholder の形式に従う（`YYYY/MM/DD` `yyyy-mm-dd` `1990年1月1日`）。無指定は `1990/05/14` |
| 生年月日（`type=date`） | `YYYY-MM-DD` 固定（value の仕様） |
| 和暦 | `era` select があれば `birth_y` は和暦年。令和 = 2019-05-01〜、平成 = 1989-01-08〜、昭和 = 1926-12-25〜 |

### 5.4 select の値の当て方

`<option>` の `value` と表示テキストの両方で照合する。都道府県は「東京都」「東京」「13」（JIS コード）のどれで来ても当てる。元号は「令和」「R」「4」を許容。月日は「5」「05」「5月」。

---

## 6. テストページに足す name 属性

`jp-form-test.html` に以下を追加して、ルールの回帰テストにする。

```
email_confirm, password, password_confirm,
zip（単一・maxlength=7）, zip（単一・maxlength=8）,
tel（単一・placeholder="090-0000-0000"）, fax,
address（単一）, address1 + address2（都道府県なし）,
birthday（type=date）, birth_year/birth_month/birth_day（select）,
age, gender（radio）, company, company_kana, department, url,
message（textarea）, agree（checkbox）,
name1 + name2, kana1 + kana2（インデックス流儀）,
placeholder="ふりがな" の欄（ひらがな判定の確認）
```

---

## 7. 決定事項（2026-09-05）

| # | 論点 | 決定 | 補足 |
|---|---|---|---|
| 1 | プロフィール | **開いた時刻で決まる人物** | 2026-09-06 変更（元は seed 0 固定）。seed はページを開いた時刻（2026-01-01 からの分数）でページ内に持つ。固定だと会員登録の再テストでメールアドレスが被る。「固定データで入力」「別人」は置かない。同じ人物が要る場面は、メールとユーザー名に付いた seed をパレットに打って呼び戻す |
| 2 | ヒント無しのカナ文字種 | **カタカナ** | label / placeholder / name / pattern にヒントがあればそれが勝つ（§5.1） |
| 3 | 同意以外の checkbox | **触らない** | 同意（規約・プライバシー）だけ ON |
| 4 | 値がある欄 | **飛ばす** | 上書きモードは作らない。補完ライブラリとの共存にもこの規則を使う（§0 の 6a/6b） |
| 5 | 電話番号 | **制度上存在しない番号** | 携帯 `090-0XXX-XXXX`（09000〜09009 は未指定。080-0 は 0800 フリーダイヤルと衝突するので使わない）。固定は `0 + 市外局番 + 1 で始まる市内局番 + 4 桁`（市内局番は 0・1 で始まらない決まり）。市外局番は都道府県から引く |
| 6 | 住所リスト | **実在の組 47 件から** | 郵便番号・都道府県・市区町村・町域は実在。番地・建物は架空。住居の無い町域（官庁街・皇居など）を優先。形の網羅は後から追加。日本郵便データからの再生成スクリプトと「全件まだ存在するか」のテストを置く |
| 7 | storage 権限 | **使わない** | 権限は activeTab / scripting / contextMenus の 3 つ。snap-redact と同じ |
