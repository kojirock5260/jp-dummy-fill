import raw from "../../../data/names.json";

/**
 * 姓名データ。`data/names.json` を型付きで読む。
 *
 * 姓 100・名は男女各 50。読みはひらがなで持つ。faker の ja には読みが無いので自前。
 * 実在の人物を指さないよう、姓も名も全国で数の多いものだけを使っている。
 */

/** `[漢字, ひらがなの読み]`。 */
export type Name = [kanji: string, kana: string];

type Raw = { family: Name[]; givenMale: Name[]; givenFemale: Name[] };

const names = raw as Raw;

export const FAMILY: readonly Name[] = names.family;
export const GIVEN_MALE: readonly Name[] = names.givenMale;
export const GIVEN_FEMALE: readonly Name[] = names.givenFemale;
