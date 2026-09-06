import { resolve } from "node:path";
import { defineConfig } from "vite";

// コンテンツスクリプト用のビルド。
//
// chrome.scripting.executeScript の files で読ませるファイルは古典スクリプトとして
// 評価されるので、import 文が残っていると動かない。IIFE で 1 ファイルに固める。
// 住所と姓名のデータ（data/*.json）もここに同梱される。実行時に読みに行く先は無い。
//
// vite.config.ts のあとに走らせる前提。
// - emptyOutDir: false … 先に出た background.js を消さない
// - publicDir: false  … manifest とアイコンは 1 回目で既にコピー済み
export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: false,
    modulePreload: false,
    rollupOptions: {
      input: resolve(import.meta.dirname, "src/content.ts"),
      output: {
        format: "iife",
        entryFileNames: "content.js",
      },
    },
  },
});
