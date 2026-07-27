/**
 * Characters that get mistaken for one another in serial numbers, model
 * codes and OCR output. Each group folds to its first character, in both
 * cases — so `l`, `I` and `|` all become `1`.
 */
export const DEFAULT_AMBIGUITY_GROUPS: readonly string[] = [
	"0O",
	"1lI|",
	"5S",
	"8B",
	"2Z",
	"6G",
];

/** Expands ambiguity groups into a per-character lookup, upper and lower case. */
export function buildAmbiguityMap(
	groups: readonly string[],
): Map<string, string> {
	const map = new Map<string, string>();
	for (const group of groups) {
		const canonical = group[0];
		if (canonical === undefined) continue;
		for (const character of group) {
			map.set(character.toLowerCase(), canonical);
			map.set(character.toUpperCase(), canonical);
		}
	}
	return map;
}

export type FoldOptions = {
	/** Drop everything that is not a letter or a digit, whitespace included. */
	stripNonAlphanumeric?: boolean;
};

/**
 * Lower-cases `value` and replaces every ambiguous character with the
 * canonical one from its group.
 */
export function foldAmbiguous(
	value: string,
	map: ReadonlyMap<string, string>,
	options: FoldOptions = {},
): string {
	const strip = options.stripNonAlphanumeric ?? false;
	let folded = "";
	for (const character of value) {
		const replacement = map.get(character);
		if (replacement !== undefined) {
			folded += replacement;
			continue;
		}
		const lowered = character.toLowerCase();
		if (strip && !/[a-z0-9]/.test(lowered)) continue;
		folded += lowered;
	}
	return folded;
}
