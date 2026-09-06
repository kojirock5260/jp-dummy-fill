import { describe, expect, it } from "vitest";
import { isMenuKind, MENU_GROUPS, MENU_KINDS } from "../../src/domain/menu";

describe("MENU_GROUPS", () => {
  it("lists every kind once", () => {
    const all = MENU_GROUPS.flatMap((g) => g.kinds);
    expect(new Set(all).size).toBe(all.length);
    expect(MENU_KINDS.size).toBe(all.length);
  });

  it("has unique group ids", () => {
    const ids = MENU_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("leaves out the kinds that mean nothing to a person picking one", () => {
    for (const kind of ["skip", "radio", "checkbox", "email_confirm", "password_confirm"]) {
      expect(isMenuKind(kind), kind).toBe(false);
    }
  });

  it("accepts the kinds it lists and rejects anything else", () => {
    expect(isMenuKind("city")).toBe(true);
    expect(isMenuKind("block")).toBe(true);
    expect(isMenuKind("bogus")).toBe(false);
    expect(isMenuKind("")).toBe(false);
  });
});

describe("ALIASES", () => {
  it("gives every kind on the palette at least one reading", async () => {
    const { ALIASES } = await import("../../src/domain/menu");
    for (const kind of MENU_KINDS) {
      expect(ALIASES[kind]?.length ?? 0, kind).toBeGreaterThan(0);
    }
  });

  it("has no alias for a kind that is not on the palette", async () => {
    const { ALIASES } = await import("../../src/domain/menu");
    for (const kind of Object.keys(ALIASES)) {
      expect(isMenuKind(kind), kind).toBe(true);
    }
  });
});
