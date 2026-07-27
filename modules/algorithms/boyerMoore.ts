import { BaseAlgorithm, type BaseAlgorithmOptions } from "../baseAlgorithm.ts";
import type { AlgorithmScore } from "../types.ts";

/** How far the pattern can safely slide when a given character mismatches. */
export function buildBadCharacterTable(pattern: string): Map<string, number> {
	const table = new Map<string, number>();
	for (let i = 0; i < pattern.length - 1; i += 1) {
		const character = pattern[i];
		if (character === undefined) continue;
		table.set(character, pattern.length - 1 - i);
	}
	return table;
}

/**
 * Boyer–Moore–Horspool substring search: compares right-to-left and skips
 * ahead on a mismatch. Returns `-1` when the pattern is absent.
 */
export function horspoolIndexOf(
	haystack: string,
	needle: string,
	table: ReadonlyMap<string, number>,
): number {
	const length = needle.length;
	if (length === 0 || length > haystack.length) return -1;

	let offset = 0;
	while (offset <= haystack.length - length) {
		let i = length - 1;
		while (i >= 0 && haystack[offset + i] === needle[i]) i -= 1;
		if (i < 0) return offset;

		const last = haystack[offset + length - 1];
		offset += (last === undefined ? undefined : table.get(last)) ?? length;
	}
	return -1;
}

export type BoyerMooreOptions = BaseAlgorithmOptions;

/**
 * Boyer–Moore–Horspool substring search — sublinear in the happy case because
 * a mismatch can skip a whole pattern length ahead. Good on long entries with
 * a varied alphabet; {@link KMPAlgorithm} is the safer bet on short, highly
 * repetitive text.
 *
 * The skip table is built once per query and reused across the dataset.
 */
export class BoyerMooreAlgorithm extends BaseAlgorithm<"boyer-moore"> {
	private cachedQuery: string | undefined;
	private cachedTable: ReadonlyMap<string, number> = new Map();

	constructor(options: BoyerMooreOptions = {}) {
		super("boyer-moore", options);
	}

	private tableFor(needle: string): ReadonlyMap<string, number> {
		if (this.cachedQuery !== needle) {
			this.cachedQuery = needle;
			this.cachedTable = buildBadCharacterTable(needle);
		}
		return this.cachedTable;
	}

	protected override score(
		candidate: string,
		query: string,
	): AlgorithmScore | null {
		const haystack = this.prepare(candidate);
		const needle = this.prepare(query);
		if (needle.length === 0 || haystack.length === 0) return null;

		const position = horspoolIndexOf(haystack, needle, this.tableFor(needle));
		if (position === -1) return null;

		return { confidence: needle.length / haystack.length, position };
	}
}

/** Creates a {@link BoyerMooreAlgorithm}. */
export function BoyerMoore(options?: BoyerMooreOptions): BoyerMooreAlgorithm {
	return new BoyerMooreAlgorithm(options);
}
