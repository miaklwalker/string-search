import { BaseAlgorithm, type BaseAlgorithmOptions } from "../baseAlgorithm.ts";
import type { AlgorithmScore } from "../types.ts";

/**
 * The KMP failure table: `table[i]` is the length of the longest proper prefix
 * of `pattern[0..i]` that is also a suffix of it.
 */
export function buildFailureTable(pattern: string): number[] {
	const table = new Array<number>(pattern.length).fill(0);
	let length = 0;
	for (let i = 1; i < pattern.length; i += 1) {
		while (length > 0 && pattern[i] !== pattern[length]) {
			length = table[length - 1] ?? 0;
		}
		if (pattern[i] === pattern[length]) length += 1;
		table[i] = length;
	}
	return table;
}

/** Knuth–Morris–Pratt substring search. Returns `-1` when the pattern is absent. */
export function kmpIndexOf(
	haystack: string,
	needle: string,
	table: readonly number[],
): number {
	if (needle.length === 0 || needle.length > haystack.length) return -1;

	let matched = 0;
	for (let i = 0; i < haystack.length; i += 1) {
		while (matched > 0 && haystack[i] !== needle[matched]) {
			matched = table[matched - 1] ?? 0;
		}
		if (haystack[i] === needle[matched]) matched += 1;
		if (matched === needle.length) return i - needle.length + 1;
	}
	return -1;
}

export type KMPOptions = BaseAlgorithmOptions;

/**
 * Knuth–Morris–Pratt substring search: O(n + m) per entry with no backtracking
 * over the candidate, which pays off on long entries and repetitive patterns
 * where naive `indexOf` degrades.
 *
 * The failure table is built once per query and reused across the dataset.
 * Confidence is how much of the candidate the query covers, and `position` is
 * the offset of the hit inside the candidate.
 */
export class KMPAlgorithm extends BaseAlgorithm<"kmp"> {
	private cachedQuery: string | undefined;
	private cachedTable: readonly number[] = [];

	constructor(options: KMPOptions = {}) {
		super("kmp", options);
	}

	private tableFor(needle: string): readonly number[] {
		if (this.cachedQuery !== needle) {
			this.cachedQuery = needle;
			this.cachedTable = buildFailureTable(needle);
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

		const position = kmpIndexOf(haystack, needle, this.tableFor(needle));
		if (position === -1) return null;

		return { confidence: needle.length / haystack.length, position };
	}
}

/** Creates a {@link KMPAlgorithm}. */
export function KMP(options?: KMPOptions): KMPAlgorithm {
	return new KMPAlgorithm(options);
}
