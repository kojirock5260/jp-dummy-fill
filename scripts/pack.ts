import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `dist/` をストアに上げる zip にする。Chrome 用と Edge 用の 2 つ。
 *
 * 中身は同じで、違うのは manifest の `commands.suggested_key` だけ。Chrome の既定
 * Ctrl/Cmd+Shift+Y / U / K は、Edge では本体のショートカット（コレクション・音声で読み上げ・
 * タブの複製）と重なり、拡張には渡らない。同じ zip を Edge に出すとショートカットが
 * 全部未設定になるので、Edge 用は Alt+Shift に載せ替える。Alt+Shift+Y / U / K は
 * Chrome にも Edge にも割り当てが無い。
 *
 * 使い方:
 *   npm run pack          … store/jp-dummy-fill-<version>.zip と store/jp-dummy-fill-<version>-edge.zip
 */

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = join(ROOT, "dist");
const OUT = join(ROOT, "store");

type Manifest = {
  version: string;
  commands: Record<string, { suggested_key: Record<string, string> }>;
};

/**
 * Edge 用に、ショートカットの修飾キーを Ctrl/Command から Alt に替える。
 *
 * @param manifest Chrome 用の manifest
 * @returns Edge 用の manifest。元は変えない
 */
function forEdge(manifest: Manifest): Manifest {
  const commands: Manifest["commands"] = {};
  for (const [name, c] of Object.entries(manifest.commands)) {
    const keys: Record<string, string> = {};
    for (const [platform, key] of Object.entries(c.suggested_key)) {
      keys[platform] = key.replace(/^(Ctrl|Command)\+/, "Alt+");
    }
    commands[name] = { ...c, suggested_key: keys };
  }
  return { ...manifest, commands };
}

/**
 * フォルダを zip に固める。`zip` コマンドを使う。macOS と Linux に入っている。
 *
 * @param dir 固めるフォルダ。中身がルートになる
 * @param out 出力する zip のパス
 */
function zipDir(dir: string, out: string): void {
  rmSync(out, { force: true });
  execFileSync("zip", ["-q", "-r", "-X", out, ".", "-x", ".DS_Store"], { cwd: dir });
}

const manifest = JSON.parse(readFileSync(join(DIST, "manifest.json"), "utf8")) as Manifest;
mkdirSync(OUT, { recursive: true });

const chrome = join(OUT, `jp-dummy-fill-${manifest.version}.zip`);
zipDir(DIST, chrome);

const work = join(tmpdir(), `jp-dummy-fill-edge-${process.pid}`);
rmSync(work, { recursive: true, force: true });
cpSync(DIST, work, { recursive: true });
writeFileSync(join(work, "manifest.json"), `${JSON.stringify(forEdge(manifest), null, 2)}\n`);
const edge = join(OUT, `jp-dummy-fill-${manifest.version}-edge.zip`);
zipDir(work, edge);
rmSync(work, { recursive: true, force: true });

console.log(`${chrome}\n${edge}`);
