import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getAddress } from "yubin";

/**
 * `data/addresses.src.json` から `data/addresses.json` を作り直す。
 *
 * 元リストは手で管理する項目（zip / kind / zone / areaCode / note、離島は name / nameKana）だけ。
 * 都道府県・市区町村・町域とその読みは、日本郵便の郵便番号データを同梱した
 * npm `yubin` で引いて足す。人が写すと読みを間違えるし、郵便番号が変わったことに
 * 気づけない。引けない zip があれば失敗させる。
 *
 * `yubin` は devDependency。8MB あるデータを拡張に入れる理由は無く、拡張が読むのは
 * 生成物の 65 件だけ。
 *
 * 使い方:
 *   npm run data          … 作り直して書き込む
 *   npm run data:check    … 作り直した結果が今のファイルと一致するか見る。違えば 1 で終わる
 */

type Source = {
  zip: string;
  kind: "center" | "island";
  zone: string[];
  areaCode: string;
  note: string;
  /** 島の通称と読み。離島だけ。パレットの表示名と絞り込みに使う */
  name?: string;
  nameKana?: string;
};

/** 出力の 1 行。キーの順序がそのままファイルの順序になる。 */
type Row = {
  zip: string;
  prefCode: number;
  pref: string;
  prefKana: string;
  city: string;
  cityKana: string;
  town: string;
  townKana: string;
  kind: Source["kind"];
  zone: string[];
  areaCode: string;
  note: string;
  name?: string;
  nameKana?: string;
};

const SRC = fileURLToPath(new URL("../data/addresses.src.json", import.meta.url));
const OUT = fileURLToPath(new URL("../data/addresses.json", import.meta.url));

/**
 * 町域名から括弧書きを落とす。「霞が関（次のビルを除く）」→「霞が関」。
 *
 * 郵便番号データの括弧書きは丁目の範囲や除外の注記で、住所として書くものではない。
 *
 * @param s 町域名か、その読み
 * @returns 括弧とその中身を除いた文字列
 */
function stripNotes(s: string): string {
  return s.replace(/（[^）]*）/g, "").replace(/\([^)]*\)/g, "");
}

/**
 * 全角の数字を半角にする。読みの「キタ３ジョウニシ」を「キタ3ジョウニシ」に。
 *
 * 読みの中の数字は住所の一部として欄に入るので、他の数字（番地）と揃えておく。
 *
 * @param s 読み
 * @returns 数字を半角にした読み
 */
function halfWidthDigits(s: string): string {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

/**
 * 元リストの全件を引いて出力の形にする。
 *
 * 1 件でも引けなければ、全部を報告してから失敗する。1 件ずつ止まると、
 * 郵便番号の改定で複数がまとめて消えたときに何往復もすることになる。
 *
 * @param sources 元リスト
 * @returns 出力の行。元リストと同じ順
 * @throws 引けない zip、事業所個別番号、複数町域の zip があった場合
 */
function build(sources: readonly Source[]): Row[] {
  const rows: Row[] = [];
  const problems: string[] = [];

  for (const s of sources) {
    const a = getAddress(s.zip);
    if (!a) {
      problems.push(`${s.zip}: 郵便番号データに無い`);
      continue;
    }
    if (a.source !== "ken_all") {
      problems.push(`${s.zip}: 事業所個別番号（${a.companyName}）。町域の番号を使うこと`);
      continue;
    }
    if (a.multiTown || a.town.includes("掲載がない")) {
      problems.push(`${s.zip}: 町域が 1 つに決まらない（${a.town}）`);
      continue;
    }
    rows.push({
      zip: s.zip,
      prefCode: Number(a.jisCode.slice(0, 2)),
      pref: a.prefecture,
      prefKana: a.prefectureKana,
      city: a.city,
      cityKana: a.cityKana,
      town: stripNotes(a.town),
      townKana: halfWidthDigits(stripNotes(a.townKana)),
      kind: s.kind,
      zone: s.zone,
      areaCode: s.areaCode,
      note: s.note,
      ...(s.name ? { name: s.name, nameKana: s.nameKana } : {}),
    });
  }

  if (problems.length > 0) {
    throw new Error(`引けない郵便番号があります:\n${problems.join("\n")}`);
  }
  return rows;
}

/**
 * 出力の文字列。
 *
 * インデント 1、末尾に改行なし。今の `addresses.json` と同じ形にしておくことで、
 * `--check` を文字列の比較で済ませられる。
 *
 * @param rows 出力の行
 * @returns ファイルに書く文字列
 */
function serialize(rows: readonly Row[]): string {
  return JSON.stringify(rows, null, 1);
}

const sources = JSON.parse(readFileSync(SRC, "utf8")) as Source[];
const next = serialize(build(sources));

if (process.argv.includes("--check")) {
  const current = readFileSync(OUT, "utf8");
  if (current === next) {
    console.log(`data/addresses.json は最新（${sources.length} 件）`);
  } else {
    const before = JSON.parse(current) as Row[];
    const after = JSON.parse(next) as Row[];
    const changed = after.filter((r, i) => JSON.stringify(r) !== JSON.stringify(before[i]));
    console.error(
      `data/addresses.json が元リストや郵便番号データと合いません（${changed.length} 件）`,
    );
    for (const r of changed.slice(0, 10)) {
      console.error(`  ${r.zip} ${r.pref}${r.city}${r.town}`);
    }
    console.error("npm run data で作り直してください");
    process.exit(1);
  }
} else {
  writeFileSync(OUT, next);
  console.log(`data/addresses.json を書きました（${sources.length} 件）`);
}
