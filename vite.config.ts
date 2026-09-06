/// <reference types="vitest/config" />

import { resolve } from "node:path";
import { defineConfig } from "vite";

// Service Worker 用のビルド。
//
// manifest に `"type": "module"` を書いていないので、出力は古典スクリプトである
// 必要がある。そのため ESM ではなく IIFE で 1 ファイルに固める。
// コンテンツスクリプト側は別設定（vite.content.config.ts）で作る。
// rollup の output.format はエントリごとに変えられないため、2 回に分けている。
export default defineConfig({
  build: {
    // 既定で埋め込まれる modulepreload polyfill を外す。この拡張に HTML は無く、
    // polyfill が持つ fetch がバンドルに残ると「外部通信ゼロ」を確かめたい人が
    // 余計な 1 件を追う羽目になる。
    modulePreload: false,
    rollupOptions: {
      input: resolve(import.meta.dirname, "src/background.ts"),
      output: {
        format: "iife",
        entryFileNames: "background.js",
      },
    },
  },
  test: {
    environment: "node",
  },
});
