import { describe, expect, it } from "vitest";
import { type FieldInfo, type FieldKind, fieldInfo } from "../../src/domain/field";
import { group } from "../../src/domain/group";

/**
 * 欄種の並びから form を組み立てて group に通す。
 *
 * @param rows 欄種と、必要なら maxlength
 * @returns 束ね直したあとの欄種
 */
function run(rows: (FieldKind | [FieldKind, Partial<FieldInfo>])[]): FieldKind[] {
  const fields = rows.map((r, i) => fieldInfo({ index: i, ...(Array.isArray(r) ? r[1] : {}) }));
  const kinds = rows.map((r) => (Array.isArray(r) ? r[0] : r));
  return group(fields, kinds);
}

describe("group / same kind in a row", () => {
  it("splits two postal fields into 3 + 4", () => {
    expect(run(["postal", "postal"])).toEqual(["postal_1", "postal_2"]);
  });

  it("splits three tel fields", () => {
    expect(run(["tel", "tel", "tel"])).toEqual(["tel_1", "tel_2", "tel_3"]);
  });

  it("splits three birth fields into year, month, day", () => {
    expect(run(["birth", "birth", "birth"])).toEqual(["birth_y", "birth_m", "birth_d"]);
  });

  it("splits two name fields into family and given", () => {
    expect(run(["name_full", "name_full"])).toEqual(["name_family", "name_given"]);
  });

  it("splits two kana fields into family and given", () => {
    expect(run(["kana_full", "kana_full"])).toEqual(["kana_family", "kana_given"]);
  });

  it("splits two address fields into town and building", () => {
    expect(run(["address_full", "address_full"])).toEqual(["town", "building"]);
  });

  it("splits three address fields into city, town and building", () => {
    expect(run(["address_full", "address_full", "address_full"])).toEqual([
      "city",
      "town",
      "building",
    ]);
  });

  it("leaves a single field alone", () => {
    expect(run(["postal", "email", "tel"])).toEqual(["postal", "email", "tel"]);
  });

  it("leaves a run whose length is not in the table alone", () => {
    expect(run(["postal", "postal", "postal"])).toEqual(["postal", "postal", "postal"]);
  });

  it("does not let a skipped field break the run", () => {
    expect(run(["postal", "skip", "postal"])).toEqual(["postal_1", "skip", "postal_2"]);
  });

  it("does not join fields separated by another kind", () => {
    expect(run(["postal", "email", "postal"])).toEqual(["postal", "email", "postal"]);
  });
});

describe("group / two tel fields", () => {
  it("reads 090-1234 / 5678 from a 7-digit first field", () => {
    expect(
      run([
        ["tel", { maxlength: 7 }],
        ["tel", { maxlength: 4 }],
      ]),
    ).toEqual(["tel_12", "tel_3"]);
  });

  it("reads 090 / 1234-5678 from a 3-digit first field", () => {
    expect(
      run([
        ["tel", { maxlength: 3 }],
        ["tel", { maxlength: 8 }],
      ]),
    ).toEqual(["tel_1", "tel_23"]);
  });

  it("reads 090 / 1234-5678 from an 8-digit second field alone", () => {
    expect(
      run([
        ["tel", {}],
        ["tel", { maxlength: 9 }],
      ]),
    ).toEqual(["tel_1", "tel_23"]);
  });

  it("puts the whole number in the first field when it cannot tell", () => {
    expect(run(["tel", "tel"])).toEqual(["tel", "skip"]);
  });
});

describe("group / mixed numbered and plain", () => {
  it("gives the plain third field tel_3 after tel_area and tel_local", () => {
    expect(run(["tel_1", "tel_2", "tel"])).toEqual(["tel_1", "tel_2", "tel_3"]);
  });

  it("fills the missing first part", () => {
    expect(run(["tel", "tel_2", "tel_3"])).toEqual(["tel_1", "tel_2", "tel_3"]);
  });

  it("gives the plain second field the rest after tel_1", () => {
    expect(run(["tel_1", "tel"])).toEqual(["tel_1", "tel_23"]);
  });

  it("gives the plain first field the front after tel_3", () => {
    expect(run(["tel", "tel_3"])).toEqual(["tel_12", "tel_3"]);
  });

  it("completes a postal pair with one numbered field", () => {
    expect(run(["postal_1", "postal"])).toEqual(["postal_1", "postal_2"]);
    expect(run(["postal", "postal_2"])).toEqual(["postal_1", "postal_2"]);
  });

  it("leaves fully numbered runs alone", () => {
    expect(run(["tel_1", "tel_2", "tel_3"])).toEqual(["tel_1", "tel_2", "tel_3"]);
  });
});

describe("group / absorbing unlabeled neighbors by maxlength", () => {
  it("takes a 4-digit text after a 3-digit postal as the second half", () => {
    expect(
      run([
        ["postal", { maxlength: 3 }],
        ["text", { maxlength: 4 }],
      ]),
    ).toEqual(["postal_1", "postal_2"]);
  });

  it("takes two short texts after a tel as the rest of a 3-way split", () => {
    expect(run(["tel", ["text", { maxlength: 4 }], ["text", { maxlength: 4 }]])).toEqual([
      "tel_1",
      "tel_2",
      "tel_3",
    ]);
  });

  it("does not absorb a text without maxlength", () => {
    expect(run([["postal", { maxlength: 3 }], "text"])).toEqual(["postal", "text"]);
    expect(run(["tel", "text", "text"])).toEqual(["tel", "text", "text"]);
  });
});

describe("group / fields too long to be a split", () => {
  it("leaves two whole-zip fields alone when a maxlength says 7 digits", () => {
    expect(
      run([
        ["postal", { maxlength: 7 }],
        ["postal", { maxlength: 8 }],
      ]),
    ).toEqual(["postal", "postal"]);
  });

  it("leaves three whole-phone fields alone when one allows 11 digits", () => {
    expect(run([["tel", { maxlength: 11 }], "tel", "tel"])).toEqual(["tel", "tel", "tel"]);
  });

  it("still splits when the lengths fit the parts", () => {
    expect(
      run([
        ["postal", { maxlength: 3 }],
        ["postal", { maxlength: 4 }],
      ]),
    ).toEqual(["postal_1", "postal_2"]);
  });
});

describe("group / a whole name next to a given name", () => {
  it("makes the whole-name field the family name, as in your-name / your-name2", () => {
    expect(run(["name_full", "name_given"])).toEqual(["name_family", "name_given"]);
    expect(run(["kana_full", "kana_given"])).toEqual(["kana_family", "kana_given"]);
  });

  it("makes a whole-name field after a family name the given name", () => {
    expect(run(["name_family", "name_full"])).toEqual(["name_family", "name_given"]);
  });

  it("leaves a lone whole-name field alone", () => {
    expect(run(["name_full", "email"])).toEqual(["name_full", "email"]);
  });
});
