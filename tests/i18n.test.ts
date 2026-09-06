import { describe, expect, it } from "vitest";

/**
 * 対訳の抜けは実行するまで気づけない。
 *
 * `chrome.i18n.getMessage` は見つからないキーに空文字を返すので、片方の言語だけ
 * メニューの文字が消える。ここで機械的に突き合わせておく。
 *
 * ファイルは `import.meta.glob` で読む。`node:fs` を使うと tsconfig の `types` に
 * node を足すことになり、拡張の本体には要らない依存が増えるため。
 */

type Entry = { message: string; placeholders?: Record<string, unknown> };
type Messages = Record<string, Entry>;

const rawLocales = import.meta.glob("../public/_locales/*/messages.json", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const rawSources = import.meta.glob("../src/**/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const rawManifest = Object.values(
  import.meta.glob("../public/manifest.json", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>,
)[0];

/** パスから言語名だけ取り出した対訳表。 */
const locales = new Map<string, Messages>(
  Object.entries(rawLocales).map(([path, text]) => {
    const parts = path.split("/");
    return [parts[parts.length - 2] ?? path, JSON.parse(text) as Messages];
  }),
);

const en = locales.get("en") ?? {};
const ja = locales.get("ja") ?? {};

describe("locales", () => {
  it("ships the two languages the manifest promises", () => {
    expect([...locales.keys()].sort()).toEqual(["en", "ja"]);
  });

  it("has the same keys in every language", () => {
    expect(Object.keys(ja).sort()).toEqual(Object.keys(en).sort());
  });

  it("leaves no message empty", () => {
    for (const [name, messages] of locales) {
      for (const [key, entry] of Object.entries(messages)) {
        expect(entry.message.length, `${name}/${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("declares the same placeholders on both sides", () => {
    for (const key of Object.keys(en)) {
      expect(Object.keys(ja[key]?.placeholders ?? {}), key).toEqual(
        Object.keys(en[key].placeholders ?? {}),
      );
    }
  });
});

describe("keys used in src", () => {
  const used = new Set<string>();
  for (const text of Object.values(rawSources)) {
    for (const m of text.matchAll(/\bmessage\("([A-Za-z0-9_]+)"/g)) {
      used.add(m[1]);
    }
    // 右クリックメニューの表題は MENUS の表に書かれ、message() には変数で渡る。
    for (const m of text.matchAll(/title: "([A-Za-z0-9_]+)"/g)) {
      used.add(m[1]);
    }
  }

  it("finds the keys at all, so this test cannot pass by looking at nothing", () => {
    expect(used.size).toBeGreaterThan(3);
  });

  it("has every used key translated", () => {
    for (const key of [...used].sort()) {
      expect(en, `en is missing ${key}`).toHaveProperty(key);
      expect(ja, `ja is missing ${key}`).toHaveProperty(key);
    }
  });
});

describe("keys used by the field menu", () => {
  // メニューの表題は `kind_${kind}` `group_${id}` と変数で組み立てるので、正規表現では拾えない。
  it("has a translation for every group and every kind", async () => {
    const { MENU_GROUPS } = await import("../src/domain/menu");
    for (const g of MENU_GROUPS) {
      expect(en, `en is missing group_${g.id}`).toHaveProperty(`group_${g.id}`);
      expect(ja, `ja is missing group_${g.id}`).toHaveProperty(`group_${g.id}`);
      for (const kind of g.kinds) {
        expect(en, `en is missing kind_${kind}`).toHaveProperty(`kind_${kind}`);
        expect(ja, `ja is missing kind_${kind}`).toHaveProperty(`kind_${kind}`);
      }
    }
  });

  it("has no stray kind_ key that the menu does not show", async () => {
    const { MENU_KINDS } = await import("../src/domain/menu");
    for (const key of Object.keys(en).filter((k) => k.startsWith("kind_"))) {
      expect((MENU_KINDS as ReadonlySet<string>).has(key.slice("kind_".length)), key).toBe(true);
    }
  });
});

describe("keys used in manifest", () => {
  // manifest は message() を通らず `__MSG_key__` で引く。名前と説明とショートカットの
  // 説明がここを通るので、抜けるとストアの表示名が生のキーになる。
  const used = [...rawManifest.matchAll(/__MSG_([A-Za-z0-9_]+)__/g)].map((m) => m[1]);

  it("references at least the name and the description", () => {
    expect(used).toContain("appName");
    expect(used).toContain("appDesc");
  });

  it("has every referenced key translated", () => {
    for (const key of used) {
      expect(en, `en is missing ${key}`).toHaveProperty(key);
      expect(ja, `ja is missing ${key}`).toHaveProperty(key);
    }
  });
});
