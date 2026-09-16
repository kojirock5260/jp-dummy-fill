# Changelog

[日本語](CHANGELOG.ja.md)

## 1.0.0 — 2026-09-17

### Added

- Credit card fields: number (Stripe's Visa test card 4242 4242 4242 4242, grouped when
  the field shows groups or is split into four boxes), cardholder name in Latin letters,
  expiry as MM/YY, MM/YYYY, YY/MM, `type=month` or separate month and year selects,
  security code, and the card brand select or radio (VISA)
- Corporate number (法人番号): 13 digits that pass the National Tax Agency check digit,
  and the invoice registration number (T + corporate number)
- Names in Latin letters: 「氏名（ローマ字）」, `name_en`, `last_name_en` and the like.
  Given name first in upper case by default, following the field's example otherwise
- Preferred dates (配達希望日, 予約日, 来店日): a weekday one week ahead
- A "Payment" group in the field palette
- Placeholder shapes count as hints: `@username` is a handle, `taro@example.com` an email,
  `https://facebook.com` a URL, which is then built under that domain
  (`https://facebook.com/abe_shou_0`). Fields whose label and placeholder are English only
  get English text instead of 「テスト入力」

### Changed

- Version 1.0.0. The rules, data and UI shipped in 0.1.0 are unchanged

## 0.1.0 — 2026-09-05

### Added

- Fill the empty fields of a Japanese form with one consistent, fictional person:
  name and kana, postal code, prefecture, address and its reading, phone and fax,
  email and password with their confirmation fields, birth date in Western or
  Japanese era years, age, gender, company, department, title, URL, free text,
  and the consent checkbox
- Three entry points: the toolbar icon, a right-click menu with three items (fill, change
  the address, fill this field with…), and the shortcuts `Cmd+Shift+Y` (fill),
  `Cmd+Shift+U` (address) and `Cmd+Shift+K` (palette)
- "Change the address to remote / island…" opens a palette of the places carriers treat
  differently (Hokkaido, Kyushu, Okinawa, and 18 outlying islands from Sagawa's relay-fee
  list) and overwrites the address fields with the pick, keeping the person. It works on
  a page that is already filled, which the earlier "same person, remote / island
  address" items did not
- "Fill this field with…" on the right-click menu, and `Cmd+Shift+K` on a focused field:
  a palette opens next to the field, you type a few characters to narrow the kinds down
  and press Enter, and the field is written with the same person's value, overwriting
  what was there. The escape hatch for a field the rules missed; the palette shows the
  rules' own guess, and each pick is logged to the console
- The person is chosen from the time the page was opened, so a repeated registration
  never reuses an email address; the address carries the person's number too. The number
  is visible at the end of the email address, and the palette's "Recall a person by
  number…" (or just typing the digits) brings a person back from a number. There is no
  fixed-data item: the one case that needs the same person again, signing in to an
  account registered earlier, is covered by the number
- A prefecture that is already selected on the page decides the address
- Field detection by `autocomplete`, `type`, `name` / `id`, label, placeholder and
  the options of a `<select>`, with Japanese labels as a first-class signal
- Split fields are recognised by number (`zip1` / `zip2`), by words (`tel_area`), by
  position (three `tel` boxes in a row) and by `maxlength`
- Kana script follows the label, the placeholder, the name and the `pattern`;
  digits follow 「全角」 hints and `inputmode`; hyphens follow `maxlength` and
  placeholders
- The postal code is written first, then the rest after 300 ms, so postal-code
  autocompletion on the page can fill the address; the block is appended when the
  autocompletion stopped at the town
- Values are set through the native property setters and announced with `input`,
  `change` and `blur`, so React and Vue controlled inputs pick them up. No key
  events, so furigana auto-input libraries are not disturbed
- 65 real postal code / town pairs (47 prefectural centers, 18 islands) with readings,
  regenerated from Japan Post's data by `npm run data`
- English and Japanese UI
- Rules checked against seven real Japanese forms (Rakuten, EC-CUBE 4, LoGoフォーム,
  Google Forms, Marketo, Snow Monkey Forms, Contact Form 7), kept as fixtures under
  `tests/fixtures/forms/`. What they taught: `<th>` row headers count as labels,
  「氏」 is a family name, 「（姓）」 reads through its brackets, a placeholder such as
  「例：5300001」 or a 「ハイフン無し」 label decides on hyphens, a placeholder naming
  市区町村 or 番地 overrides a mislabeled `autocomplete`, `autocomplete="new-password"`
  on a text field is an anti-autofill hack rather than a password, Contact Form 7's
  `acceptance` boxes are consent, site-search forms and `<select>`s whose options are
  URLs are left alone, and a free-text kind that lands on a `<select>` takes the first
  option
- Amazon's four-way address (市区町村 / 丁目・番地・号 / 建物名 / 部屋番号) added the
  `block`, `room` and `country` field kinds. With a block field the city field carries
  the town, with a room field the building field carries only the building name, and a
  country selector gets Japan or is left alone. `PostalCodeOne` / `Two` count as a split
