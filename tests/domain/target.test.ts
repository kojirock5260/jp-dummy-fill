import { describe, expect, it } from "vitest";
import { isFillable } from "../../src/domain/target";

describe("isFillable", () => {
  it("accepts ordinary pages", () => {
    expect(isFillable("https://example.jp/entry")).toBe(true);
    expect(isFillable("http://localhost:3000/")).toBe(true);
    expect(isFillable("file:///Users/me/form.html")).toBe(true);
  });

  it("rejects privileged pages that cannot be injected into", () => {
    expect(isFillable("chrome://extensions")).toBe(false);
    expect(isFillable("devtools://devtools/bundled/inspector.html")).toBe(false);
    expect(isFillable("view-source:https://example.com")).toBe(false);
    expect(isFillable("chrome-extension://abc/page.html")).toBe(false);
  });

  it("rejects the web store, where the browser forbids injection", () => {
    expect(isFillable("https://chromewebstore.google.com/detail/abc")).toBe(false);
    expect(isFillable("https://chromewebstore.google.com")).toBe(false);
    expect(isFillable("https://chrome.google.com/webstore/category/extensions")).toBe(false);
  });

  it("accepts the rest of chrome.google.com", () => {
    expect(isFillable("https://chrome.google.com/")).toBe(true);
  });

  it("is not fooled by a lookalike host", () => {
    expect(isFillable("https://chromewebstore.google.com.example.com/")).toBe(true);
  });

  it("is case insensitive", () => {
    expect(isFillable("CHROME://settings")).toBe(false);
  });

  it("rejects a tab with no url yet", () => {
    expect(isFillable(undefined)).toBe(false);
    expect(isFillable("")).toBe(false);
  });
});
