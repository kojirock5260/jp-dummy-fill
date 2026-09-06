# jp-dummy-fill

[日本語](README.ja.md)

Fill Japanese forms with test data that passes validation, in one click.
A Chrome extension.

Dummy-data tools built for English forms do not get through Japanese ones. Furigana
must be full-width katakana, the postal code is split 3 + 4, the phone number into
three boxes, the prefecture is a `<select>`, and typing the postal code fills in the
address. jp-dummy-fill knows all of that.

## Principles

- **No install warnings**: `permissions` is only `activeTab`, `scripting` and
  `contextMenus`. "Read and change all your data on all websites" never appears
- **Nothing sent, nothing kept**: zero external communication. No `storage` either
- **Nothing extra**: no options page, no account, no billing
- **It gets through**: values are shaped for the validation and autocompletion that
  Japanese forms actually use
- **Fictional**: nothing points at a real person. Only the postal code and the town
  are real

## Privacy

Nothing is collected or transmitted. The extension reads the attributes of the form
fields on the tab you invoked it on, writes values into the empty ones, and reports
how many it filled. No `storage` permission is requested, so nothing persists. See
the [Privacy Policy](PRIVACY.md) for details.

## Install

Chrome Web Store: (not published)

See the [changelog](CHANGELOG.md) for what changed in each version.

## Development

```bash
npm install
npm run build   # outputs to dist/
```

To run your build in Chrome:

1. Open `chrome://extensions`
2. Turn on "Developer mode" in the top right
3. "Load unpacked" → select the `dist/` folder

Then open `tests/fixtures/jp-form-test.html` and try it. "Allow access to file URLs"
must be on for `file:` pages, or serve the folder over `http://localhost`.

## Usage

Three entry points. All of them grant `activeTab`.

| Entry | What it does |
|---|---|
| Toolbar icon | Fill this page |
| Right-click menu | Three items, below |
| Shortcut | `Cmd+Shift+Y` fill, `Cmd+Shift+U` change the address to remote / island…, `Cmd+Shift+K` fill the focused field with… (`Ctrl` on Windows and Linux). F is avoided because Fake Filler's default is `Ctrl/Cmd+Shift+F` |

Right-click menu:

| Item | What it does |
|---|---|
| Fill this page | Fills the empty fields with the person the page got when it was opened. A new person every time the page is opened (disposable data) |
| Change the address to remote / island… | Opens a palette of places. Pick one and the person stays while the **address fields are overwritten** (below) |
| Fill this field with… | Opens a palette next to the right-clicked field (below) |

A new person each time the page is opened, so repeating a registration never trips
over last time's email address. There is no "fixed data" or "someone else" item:
reload the page for a new person.

Every person carries a number, visible at the end of the email address
(`shou.abe.4213@example.jp` → 4213). To bring back the person behind an existing
record, open "Fill this field with…" and type that number into the palette, then
Enter. The number lives inside the page; every tab has its own person.

**To test shipping fees and delivery restrictions**, use "Change the address to remote /
island…" (`Cmd+Shift+U`). The palette lists the places carriers treat differently; type 「さど」 or
「おきなわ」 and press Enter. The person stays, and only the postal code, prefecture,
address and fax fields are rewritten for that place, even on a page that is already
filled. "Back to the person's own address" undoes it.

| Group | Places |
|---|---|
| Regions with their own shipping rate | Hokkaido (Sapporo), Kyushu (Fukuoka), Okinawa main island (Naha) |
| Outlying islands | 礼文島, 奥尻島, 飛島, 伊豆大島, 八丈島, 父島, 佐渡島, 隠岐, 小豆島, 対馬, 福江島, 屋久島, 奄美大島, 与論島, 宮古島, 石垣島, 与那国島, 南大東島 |

The grouping follows Yamato (Hokkaido and Okinawa are separate rate zones, no island
surcharge), Sagawa (its list of islands with a relay surcharge) and Amazon.co.jp
("Honshu / Shikoku" versus "Hokkaido / Kyushu / Okinawa / islands"). 飛島 is there as the
case where only part of a city is an island, so a city-name check cannot catch it.

**When a field is left empty or filled wrongly**, right-click it and choose "Fill this
field with…", or focus it and press `Cmd+Shift+K`. A small palette opens next to the
field: type a few characters (「しく」 for 市区町村, 「せい」 for フリガナ（セイ）) and
press Enter. The value comes from the same person as the rest of the page, in the
format that field asks for, and it **overwrites** what is there. This is the one place
where an existing value is replaced: you named the field yourself. The palette shows
what the rules had detected, and each manual pick is logged to the DevTools console
(Verbose level), which is the raw material for improving the rules.

**If the prefecture is already selected**, the address comes from that prefecture.
Pick the `<select>` by hand first to aim at a particular one.

**Fields that already have a value are always skipped.** There is no overwrite mode; the
only fields rewritten are the one you name in the palette and the address fields when
you choose a place. Only the consent checkbox (terms, privacy) is ticked; other
checkboxes are left alone.

When it finishes, the toolbar badge shows the number of fields filled for two seconds.
When it cannot fill the page, the badge shows `!` and the tooltip says why.

## What goes in

| Field | Example |
|---|---|
| Name, split or whole | 阿部 / 翔, 阿部　翔 |
| Kana | アベ / ショウ. Hiragana when the label or placeholder says so, half-width when the pattern does |
| Postal code | 100-0013, or 1000013 for a 7-character box, or 100 / 0013 when split |
| Prefecture | 東京都, matched against the `<select>` by name, short name, JIS code or kana |
| Address | 千代田区霞が関4-10-12 霞が関ビル 301, adjusted to whichever of prefecture / city / block / building / room has its own box. Amazon's 市区町村 / 丁目・番地・号 / 建物名 / 部屋番号 becomes 千代田区霞が関 / 4-10-12 / 霞が関ビル / 301 |
| Address kana | トウキョウトチヨダクカスミガセキ4-10-12 |
| Phone | 090-0947-6865, split 3-4-4 when there are three boxes. Fax gets a landline |
| Email, password | shou.abe.4213@example.jp (the number keeps registrations from colliding), a fixed `Dummy!Pass01`. Confirmation fields get the same value |
| Birth date | 1984-07-18 for `type=date`, 昭和 / 59 / 7 / 18 when there is an era select |
| Age, gender | 42, 男性 (radio or select) |
| Company | 阿部商事株式会社, アベショウジ, 営業部, 課長 |
| Free text | Two or three Japanese sentences, not lorem ipsum |

Phone numbers cannot exist: mobiles use the unassigned `090-0XXX-XXXX` band, and
landlines use a local exchange starting with 1, which is never allotted. `example.jp`
is the example domain reserved by JPRS. Postal code, prefecture, city and town are
real pairs from Japan Post's data; block and building are made up.

## Coexisting with postal-code autocompletion

Many Japanese forms fill the address from the postal code (yubinbango, ajaxzip3).
The extension writes the postal code first, waits 300 ms, and then fills only what is
still empty. Whichever side wins, the data is the same real pair, so the result is the
same. Libraries usually stop at the town, so the block (and the building, when it has
no box of its own) is appended to an address field that ends with the person's town
and holds no digits yet. That is the one exception to "never touch a filled field".

Key events are never dispatched, so furigana auto-input libraries (autokana and the
like) are not disturbed.

## Layout

```
src/
  domain/        pure rules. no DOM, no chrome.*, fully unit tested
    classify.ts  which field is which (docs/field-rules.md §1–§2)
    group.ts     split fields (§3)
    person.ts    one consistent person from a seed (§4)
    render.ts    value per field kind, with script and format (§5)
    plan.ts      the pipeline above, as one function
  application/   side effects through browser APIs (fill, notify, i18n)
  presentation/  DOM in (collect) and DOM out (write)
  background.ts  service worker. three entry points, nothing else
  content.ts     injected script. holds the seed, guards against double injection
data/
  addresses.src.json   65 postal codes with kind / zone / area code (and a name for islands), kept by hand
  addresses.json       generated: the above plus prefecture, city, town and readings
  names.json           100 family names, 50 given names per sex, with readings
docs/
  spec.md              the specification
  field-rules.md       field classification rules
```

`domain` never imports from the layers above it. Everything that decides what to
write is testable in plain Node; the DOM layer is tested with jsdom, including the
fixture forms under `tests/fixtures/`.

## Data

```bash
npm run data          # regenerate data/addresses.json from addresses.src.json with Japan Post data
npm run data:check    # fail if the file no longer matches the source and the current postal data
```

`yubin` (Japan Post postal data on npm) is a devDependency. It never ships in the
extension; the extension only carries the generated 65 rows.

## Test and Lint

```bash
npm test          # run Vitest once
npm run test:watch
npm run lint      # Biome (lint + format check)
npm run lint:fix  # apply fixes
```

## Checked against real forms

The rules were run over eight real Japanese forms (Rakuten's registration, the EC-CUBE 4
demo, a municipal LoGoフォーム, a Google Form, a Marketo form, Snow Monkey Forms,
Contact Form 7 and Amazon's address book). Their field structure is kept under `tests/fixtures/forms/` and the
expected classification in `tests/domain/forms.test.ts`, so a rule change that breaks
one of them fails the suite. `docs/forms-survey.md` lists what each form taught and how
to add another one with `scripts/capture-form.js`.

## Notes

- **English forms are out of scope.** Names are Japanese only; that is Fake Filler's territory
- **Forms inside a cross-origin iframe are out of reach** (Salesforce's contact form is
  one). Dropdowns built from a `readonly` input (Vuetify, MUI) and `div[role=radio]`
  controls (Google Forms) are not filled either
- **Site-search boxes and `<select>`s whose options are URLs are left alone.** Filling
  the latter would navigate away from the page
- **No saved real address of your own.** That is what Chrome's autofill is for
- **Nothing runs until you ask.** No page resident, no form detection on load
- **Some pages cannot be filled**: the Web Store, `chrome://` pages, and `file://`
  unless "Allow access to file URLs" is on. The toolbar icon shows a red `!` and the
  reason in its tooltip
- **Kyoto street-name addresses, corporate numbers, test credit card numbers and
  Firefox** are on the list, not in this version

## Contributing

As a security policy, **pull requests are not being accepted for now.**

Please open an Issue for bug reports and suggestions.

## About development

This project is built with the help of [Claude](https://claude.com) (Anthropic).
