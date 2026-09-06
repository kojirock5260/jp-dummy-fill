# jp-dummy-fill

[日本語](README.ja.md)

Fill Japanese forms with dummy data that passes validation, in one click. A Chrome extension.

## Principles

- **No install warnings**: only `activeTab`, `scripting` and `contextMenus`
- **Nothing sent, nothing kept**: zero network, no `storage`
- **Nothing extra**: no options page, no account, no billing
- **It gets through**: kana script, split postal code and phone fields, prefecture selects and postal-code autocompletion are all handled
- **Fictional**: only the postal code and the town are real

## Privacy

Nothing is collected or transmitted. The extension reads the form fields on the tab you invoked it on and writes into the empty ones. See the [Privacy Policy](PRIVACY.md).

## Install

Chrome Web Store: (not published)

See the [changelog](CHANGELOG.md).

## Development

```bash
npm install
npm run build       # outputs to dist/
npm test            # Vitest
npm run lint        # Biome
npm run data        # rebuild data/addresses.json from Japan Post data
```

1. Open `chrome://extensions`
2. Turn on "Developer mode"
3. "Load unpacked" → `dist/`

Try it on `tests/fixtures/jp-form-test.html`.

## Usage

| Entry | What it does |
|---|---|
| Toolbar icon | Fill this page |
| Right-click menu | Three items, below |
| `Cmd+Shift+Y` / `U` / `K` | Fill / change the address / fill this field (`Ctrl` on Windows and Linux) |

| Item | What it does |
|---|---|
| Fill this page | Fills the empty fields with one person. A new person every time the page is opened |
| Change the address to remote / island… | Pick a place and only the address fields are rewritten. For shipping tests |
| Fill this field with… | Overwrites the right-clicked field with the kind you pick. The fix for a field the rules missed |

Palettes filter as you type: 「さど」 → 佐渡島, 「しく」 → 市区町村.

**Places**: Hokkaido, Kyushu, Okinawa main island and 18 islands (礼文島, 奥尻島, 飛島, 伊豆大島, 八丈島, 父島, 佐渡島, 隠岐, 小豆島, 対馬, 福江島, 屋久島, 奄美大島, 与論島, 宮古島, 石垣島, 与那国島, 南大東島), grouped the way Yamato, Sagawa and Amazon.co.jp charge shipping.

**Same person again**: type the number at the end of the email address (`shou.abe.4213@example.jp` → 4213) into a palette.

**Filled fields are skipped.** Only the two palettes overwrite. A prefecture already selected decides the address. Only the consent checkbox is ticked.

## What goes in

| Field | Example |
|---|---|
| Name, kana | 阿部 翔 / アベ ショウ. Hiragana when the label asks for it |
| Postal code | 100-0013, 1000013 for a 7-digit box, 100 / 0013 when split |
| Address | 東京都 / 千代田区霞が関4-10-12 / 霞が関ビル 301, shaped to the boxes on the page |
| Phone, fax | 090-0947-6865 (three boxes too) / 03-1234-5678 |
| Email, password | shou.abe.4213@example.jp / `Dummy!Pass01`. Confirmation fields get the same |
| Birth date, age, gender | 1984-07-18 (昭和 59 with an era select) / 42 / 男性 |
| Company | 阿部商事株式会社, 営業部, 課長 |
| Free text | Two or three Japanese sentences |

Phone numbers use unassigned ranges. `example.jp` is JPRS's reserved example domain.

## Layout

```
src/
  domain/        rules. no DOM, no chrome.* (docs/field-rules.md)
  application/   side effects through browser APIs
  presentation/  collect from the DOM, write to it, the palette
  background.ts  service worker
  content.ts     injected script
data/            65 addresses, 100 family and 100 given names
docs/            spec, field rules, real-form survey
tests/fixtures/  test forms and the field structure of 8 real sites
```

## Notes

- English forms are out of scope
- Coexists with postal-code autocompletion (yubinbango, ajaxzip3): the postal code goes first, and fields the page fills are left alone
- Cross-origin iframes, `readonly`-input dropdowns and `div[role=radio]` cannot be filled
- The Web Store, `chrome://` and `file://` without file access are refused; the icon shows `!`
- `Cmd+Shift+F` is avoided because it is Fake Filler's default

## Contributing

As a security policy, **pull requests are not accepted for now.** Please open an Issue.

## About development

This project is built with the help of [Claude](https://claude.com) (Anthropic).
